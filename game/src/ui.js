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
//   slap(n, { x, y })                       a tap on the face: squash + one "啪" at a time (n = taps so far; 3 = a bigger
//                                           one with an impact ring)
//   stampHold(level | null)                 the gold stamp above the customer's head grows (0 / 1 / 2); null hides it
//   stampSlam()                             the stamp slams onto the forehead and leaves a red "兩個月" mark (a prop)
//   setFling({ dir, speed } | null)         the next customerReact('gun'|'gun2') flings the customer that way (physics)
//   bowl(n)                                 n (1–3) queue silhouettes at the right edge topple, the camera leans right
//                                           (no text; the caller plays the sound)
//   rageHeadAdd(customer, n, { liveMs }) / rageHeadHit(n, key) / clearRageHeads()   rage heads in a row (gesture rage)
//   gestureHint(key, text)                  the chip pulses; the words once per key, then a finger demo (三下 + ripples);
//                                           gestureHint('rage'): the finger sweeps one long stroke over the rage row
// ---- 吼罵模式 / voice mode (docs/gameplay-v2.md 10; the gesture surface stays on, inputMode reads 'gesture')
//   setInputMode('voice')                   gestures + the voice layer (stage[data-voice=1]); the start card toggle shows 吼
//   setVoiceOptions({ whisper, replay, keywords, keywordsAvailable })   the small switches under the toggle (voice only)
//   voicePrompt(texts) → Promise<boolean>   the "這家店要你親口罵" microphone card (allow / use gestures instead)
//   karaoke({ setup, punch, key } | null)   the line to say, in the subtitle slot, plain: setup small, punch big (no labels)
//   karaokeProgress({ setup, punch })       0..1 each: how far the player's voice has lit it up
//   voiceMeter(on) / voiceLevel(v, level, { marks, punch })   the loudness capsule at the right edge (v 0..1, level
//                                           -1..2; three unlabelled notches); punch / voicePunch(): the needle hits the top
//   voiceStatus('calib' | 'replay' | '')    no text: a mic with three pulsing dots / the wall megaphone sends rings
//   voiceToast()                            no-op (floating voice captions are gone, art-direction-v2 9)
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
//   clerkBeat({ setupMs, punchStartMs, punchMs, landMs = 650, shake, flash, fx, key })   the three beats, performed
//                                           (art-direction-v2 8.4): idle+squint (subtitle punch held back) → hard cut to hit
//                                           at punchStartMs + punchFx (hit-stop, directional shake, camera punch-in, punch
//                                           words pop in the key colour) → perfect 120 ms after the hit-stop (tidy) → idle.
//                                           fx 'normal'|'curse'|'mega' = FX level small / medium / big
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
//   setSignMult()                           no-op (no ×2 / ×1.5 tags on the sign, art-direction-v2 9)
//   kick(face, { n })                       jab while the answered customer flies (gameplay-v2 3): the customer flies
//                                           40% farther (+180° for 滾), the small FX level, no word
//   setForced(on)                           forced politeness (too slow): service tint, polite clerk until off
//   signExit(face)                          the sign leaves now (5.2: on the press, 150 ms, before the result 花字):
//                                           'gun' crumple | 'gun2' to the monitor | 'shut' strike + sink | 'take' stamp + slide
//                                           ('take': red ink + a receipt strip; a 250 sign: the gold stamp)
//   customerReact(face)                     'gun'|'gun2'|'shut'|'take' (fly-out, plus signExit if the sign is still up)
//                                           | 'suck' | 'sink' | 'miss' ('take' also advances the 叫號器 number); particles
//                                           sized by the answer's FX level (ice for 滾, pearls for 閉嘴, gold cups for a 250)
//   customerPose({ look, chin, talk, gray, cower }) look → .drift, chin → .proud, talk → .talk, cower → .cower (head
//                                           ducks down a third); gray re-renders the grey copy
//   showPlate(lines, { ms = 350 }) → Promise ticket flies from the clerk's hand to the forehead (E11); plateGlow(on); clearPlate()
//   clearCustomer()
// ---- Camera + screen fx (2.11)
//   camera(focus, scale, ms = 0, ease?)     focus 'FACE'|'MOUTH'|'SIGN'|'CUST'|'GOLDSIGN'|'WIDE' or [x%, y%]; ease defaults to
//                                           cubic-bezier(.2,.8,.2,1), or (.5,0,.2,1) for ms <= 120. Reduced motion: scale <= 1.10
//   flash(ms = 40)                          white flash (big FX level; off with reduced motion)
//   speedLines(ms = 300)                    thin cream speed lines on the outer 30% only, ≤ 400 ms (off: reduced motion, lite)
//   punchFx(level, key)                     one FX hit: 'small' | 'medium' | 'big' (8.1) along the key's fly-out direction
//   setLite(on) / lite                      K4 lite mode: camera cuts, no idle loops (auto-detected on slow devices)
//   shake(px, ms = 200, dir?)               two decaying swings along dir ([x, y]; default the last answer's way); halved
//                                           with reduced motion
//   freeze(ms)                              pause every animation / transition on the stage for ms (定格)
//   letterbox(on)                           14% black bars (ref-counted; S5 uses it too)
//   gate(open, ms = 500) → Promise          gate('close') shows the shutter; gate(true) rolls it up and removes it
//   goldsign(on)                            lightbox "黃金比例" glow (.shop[data-gold])
// ---- 花字 (art-direction-v2 8.3; picking and the allow list live in src/huazi.js)
//   huazi(list, timing?) → { done: Promise, cancel() }   only allowed items render (S3 never, S4 as symbols, S1/S2 only
//                                           signature words or items with big: true); one on screen, ≥ 900 ms apart
//                                           items { text, style: 'S1'..'S5'|1..5|'emph', seg, ratio, at?, size?: 'sm',
//                                           fontSize?, pos?: [x%, y%], break? (S1 shatters at 150 ms), charMs?, holdMs?,
//                                           onChar?(i, ch) (S5 typing hook for the tick sound) }
//                                           timing { setupStartMs, setupMs, punchStartMs, punchMs, minAt };
//                                           none before minAt (e.g. while a sign is still showing its wrong-answer hint).
//                                           Kept ≥ 4cqw clear of the sign (push up to y 8%, then shrink to 9cqw, else the
//                                           words are emphasised in the subtitle instead). Bleep mode: X你媽 → X你嗶 (boxed).
//   clearHuazi({ pendingOnly })             removes visible and pending 花字 (pendingOnly: only those not shown yet;
//                                           a sign that rises later still clears the visible ones in its way)
// ---- Subtitles (2.3)
//   showLine(text, { who = 'clerk'|'cust'|'system', color, style })   '|' removed, no stage directions; customer lines
//                                           get a colour bar (color: 'gun'|'shut'|'take' or any CSS colour); a clerk line's
//                                           punch is .sub-punch (big, key colour; clerkBeat pops it); long lines get .long
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
//   setQuick()                              no-op (no 快嘴 badge, art-direction-v2 9)
//   setCombo(n, quick)                      the combo cup stack on the counter (3 / 5 / 7 cups at 5 / 10 / 20; steams in fast
//                                           mouth, with faint edge speed lines)
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
import { subtitleParts, stripStage, isAllowedHuazi, s4Symbol, HZ_GAP_MS } from './huazi.js';

const KEYS = ['gun', 'shut', 'take'];
const KEYBOARD = { j: 'gun', k: 'shut', l: 'take' };
const CHARGE_MS = [300, 800];
const SVGNS = 'http://www.w3.org/2000/svg';

const FONT_ZH = '"Noto Sans TC","PingFang TC","Microsoft JhengHei","Heiti TC","Noto Sans CJK TC",sans-serif';
const FONT_SIGN = '"LXGW WenKai TC","Kaiti TC","STKaiti","BiauKai","DFKai-SB",' + FONT_ZH;
const FONT_EN = '"Bangers","Impact","Arial Black",sans-serif';
const KEY_COLOR = { gun: '#E8402F', shut: '#6A4EE8', take: '#FFC21A' };

/** Named focus points in stage percent (2.11). */
export const FOCUS = { FACE: [50, 26], MOUTH: [50, 30], SIGN: [30, 55], CUST: [29, 67], GOLDSIGN: [72, 11.5], WIDE: [50, 40] };

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
    replayBtn: '再聽一次 ▸' },
  en: { voice: 'Shout', whisper: 'Whisper mode', replay: 'Replay my shout', keywords: 'Understand my words', kwNote: "The browser's speech recognizer may use a cloud service",
    replayBtn: 'Play again ▸' },
};

const DEFAULT_UI = {
  zh: { gun: '滾！', shut: '閉嘴！', take: '收！', queue: '排隊', aura: '氣勢', fury: '火氣', start: '開店！', again: '再罵一天', bleep: '消音', combo: '連擊', time: '秒' },
  en: { gun: 'SCRAM!', shut: 'SHUT IT!', take: 'DEAL!', queue: 'Queue', aura: 'Swagger', fury: 'Fury', start: 'OPEN SHOP!', again: 'Rant Again', bleep: 'Bleep', combo: 'Combo', time: 's' },
};

// ---------------------------------------------------------------- FX constants (package C, docs/art-direction-v2.md 8)

// Three FX levels (8.1): the biggest is saved for climaxes (調你媽, charge 2, a 250 hit, the boss's last step, rage).
//   freeze = hit-stop ms, shake = px along the fly-out direction, zoom = camera push-in, n = particles
const FX_TIER = {
  small: { freeze: 40, shake: 4, zoom: 1.04, n: [3, 5], ms: 200 },
  medium: { freeze: 70, shake: 8, zoom: 1.08, n: [6, 8], ms: 240 },
  big: { freeze: 120, shake: 12, zoom: 1.25, n: [10, 10], ms: 300, flash: 40, lines: 300, focus: 'MOUTH' },
};
const TIER_OF = { normal: 'small', curse: 'medium', mega: 'big', small: 'small', medium: 'medium', big: 'big' };
// the way a customer flies for each answer (stage px direction): shake and particles follow it
const FLY_DIR = { gun: [-0.8, -0.6], gun2: [0.55, -0.83], shut: [0, 1], take: [1, -0.12] };
const PARTICLE_OF = { gun: 'ice', gun2: 'ice', shut: 'pearl', take: 'ink' };
// key colours for the subtitle punch words (7.7): 收 uses lemon so it reads on the dark band
const PUNCH_COLOR = { gun: 'var(--gun, #EE4130)', gun2: 'var(--gun, #EE4130)', shut: 'var(--shut, #7658F2)', take: 'var(--lemon, #FFD84A)' };
const HZ_FONT_EN = '"Baloo 2","Arial Black",sans-serif';
// the stamp leaves a red mark on the forehead (a prop, not a caption, 9)
const STAMP_MARK = { zh: '兩個月', en: '2 MONTHS' };
const VM_MEGA_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4h3l7 5V5L6 10Z" fill="#FFF7E6" stroke="#1B1311" stroke-width="1.4" stroke-linejoin="round"/>' +
  '<path class="vm-wave" d="M16 8.5a5 5 0 0 1 0 7M18.6 6a8.6 8.6 0 0 1 0 12" fill="none" stroke="#FFF7E6" stroke-width="1.6" stroke-linecap="round"/></svg>';
const VM_MIC_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="3" width="7" height="12" rx="3.5" fill="#FFF7E6" stroke="#1B1311" stroke-width="1.3"/>' +
  '<path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" fill="none" stroke="#FFF7E6" stroke-width="1.6" stroke-linecap="round"/></svg>';

// Placeholder art until package A exports cupStackSVG(n) / PARTICLE_SVG / MEGAPHONE_SVG (art.js); swapped automatically.
const CUP_COLORS = [['#C98A55', '#8A5A33'], ['#7FD6A4', '#3CA06E'], ['#FFE07A', '#D9A92E'], ['#F7A8C0', '#C9738E']];
function placeholderCupStack(n) {
  const rows = n >= 7 ? [4, 3] : n >= 5 ? [3, 2] : n >= 3 ? [2, 1] : [n];
  const W = 12, H = 15, out = [];
  let k = 0;
  rows.forEach((count, r) => {
    const y = 40 - (r + 1) * H;
    const x0 = 26 - (count * W) / 2;
    for (let i = 0; i < count; i++, k++) {
      const x = x0 + i * W;
      const [c, sh] = CUP_COLORS[k % CUP_COLORS.length];
      out.push(`<path d="M${x + 1} ${y + 3} H${x + W - 1} L${x + W - 2.2} ${y + H} H${x + 2.2} Z" fill="${c}" stroke="#4A2C1C" stroke-width=".7"/>` +
        `<path d="M${x + W - 4} ${y + 3} L${x + W - 1} ${y + 3} L${x + W - 2.2} ${y + H} H${x + W - 4.6} Z" fill="${sh}" opacity=".55"/>` +
        `<rect x="${x + 0.4}" y="${y + 1.4}" width="${W - 0.8}" height="2" rx="1" fill="#FFF7E6" stroke="#4A2C1C" stroke-width=".6"/>`);
    }
  });
  return `<svg viewBox="0 0 52 40" aria-hidden="true">${out.join('')}</svg>`;
}
const cupStackMarkup = (n) => (typeof art.cupStackSVG === 'function' ? art.cupStackSVG(n) : placeholderCupStack(n));
const megaphoneMarkup = () => art.MEGAPHONE_SVG || VM_MEGA_SVG;

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

export function createUI(root, { onPress = () => {}, onCharge = () => {}, onRelease = () => {}, onGesture = () => {}, onStart = () => {}, onToggleLang = () => {}, onToggleBleep = () => {}, onToggleInput = () => {}, onVoiceOption = () => {} } = {}) {
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
  const stage = el('div', 'stage', root);
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
  const cupStack = el('div', 'cup-stack', cam);    // C: the combo cup stack on the counter top (setCombo)
  cupStack.hidden = true;
  const voiceMega = el('div', 'vm-mega', cam);     // C: voice mode: the shop megaphone on the wall (replays)
  voiceMega.hidden = true;

  el('div', 'tint tint-polite', shaker);
  el('div', 'tint tint-rage', shaker);
  const fx = el('div', 'fx-layer', shaker);
  const fxEdge = el('div', 'fx-edge', shaker);       // C: red rage vignette / fast-mouth edge speed lines
  fxEdge.setAttribute('aria-hidden', 'true');
  const ptLayer = el('div', 'particles', shaker);    // C: pooled particles (ice, pearls, ink, receipt, gold cups)
  ptLayer.setAttribute('aria-hidden', 'true');
  const hzLayer = el('div', 'hz-layer', shaker);
  const hzDefs = svgEl('svg', { class: 'hz-defs', width: 0, height: 0, 'aria-hidden': 'true' }, hzLayer);
  const defs = svgEl('defs', {}, hzDefs);
  const grad = svgEl('linearGradient', { id: 'hzGold', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  svgEl('stop', { offset: '0%', 'stop-color': '#FFF3B0' }, grad); // --gold-hi
  svgEl('stop', { offset: '45%', 'stop-color': '#FFD23A' }, grad);
  svgEl('stop', { offset: '100%', 'stop-color': '#F29A00' }, grad);

  const flashEl = el('div', 'flash', stage);
  const letterboxEl = el('div', 'letterbox', stage);

  // HUD (outside the camera)
  const hud = el('header', 'hud', stage);
  const hudTop = el('div', 'hud-row', hud);
  const qBox = el('div', 'hud-queue', hudTop);
  const qLabel = el('span', 'hud-label', qBox);
  const qNum = el('span', 'hud-qnum', qBox, '0');
  const timeBox = el('div', 'hud-time', hudTop);
  const timeNum = el('span', 'hud-tnum', timeBox, '45');
  const timeUnit = el('span', 'hud-tunit', timeBox); // review: a bare "90" read as nothing
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
  const quickBox = el('div', 'hud-quick', hud);   // stage 2: fast mouth

  // Subtitle band (y 74–80%) and buttons (y 80–100%)
  const subs = el('section', 'subs', stage);
  // voice mode: the karaoke line sits just above the subtitle band; the loudness meter at the right edge
  const karaokeEl = el('div', 'karaoke', stage);
  karaokeEl.hidden = true;
  const vMeter = el('div', 'vmeter', stage);
  vMeter.hidden = true;
  vMeter.setAttribute('aria-hidden', 'true');
  html(el('div', 'vm-icon', vMeter), VM_MEGA_SVG);
  const vTrack = el('div', 'vm-track', vMeter);
  const vFill = el('div', 'vm-fill', vTrack);
  const vMarks = [0, 1, 2].map((i) => el('span', 'vm-mark vm-mark-' + i, vTrack)); // three notches, no words (9)
  const vStatus = el('div', 'vm-status', vMeter); // calibrating: a mic and three pulsing dots, no words (9)
  html(vStatus, VM_MIC_SVG + '<i></i><i></i><i></i>');
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
  const milestoneCard = el('div', 'milestone hidden', stage);
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
    const gt = GESTURE_TEXT[lang] || GESTURE_TEXT.zh;
    for (const k of KEYS) chips[k].label.textContent = `${gt.verb[k]} ${String(texts[k] ?? '')}`;
    langBtn.innerHTML = lang === 'zh' ? '<b>中</b>/EN' : '中/<b>EN</b>';
    bleepBtn.textContent = texts.bleep;
    bleepBtn.classList.toggle('on', bleepOn);
    bleepBtn.setAttribute('aria-pressed', String(bleepOn));
    root.lang = lang === 'zh' ? 'zh-Hant-TW' : 'en'; // Chinese is Traditional (Taiwan) at the source
    stage.dataset.lang = lang;
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
    || !!closingEl || !recapEl.hidden;
  function inputLocked() {
    return extLocked || phase === 'over' || overlayUp();
  }
  function syncLock() {
    stage.dataset.locked = inputLocked() ? '1' : '0';
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
    KEYS.forEach((k) => endHold(k));
    resetGestures();
    cancelAnimationFrame(gLoop);
    gLoop = 0;
  }
  function setGestureHints(on) {
    stage.dataset.ghints = on ? '1' : '0';
  }
  const vibe = (p) => { try { navigator.vibrate?.(p); } catch { /* optional */ } };

  // 連拍: each tap is a cartoon slap on the counter-side of the face: a squash, ONE "啪" at a time (8.3), a tiny shake.
  // The third tap is one bigger "啪" with a ring of impact lines instead of a third stacked word. No marks on anyone.
  let paEl = null;
  function slap(n = 1, { x, y } = {}) {
    const gt = GESTURE_TEXT[lang] || GESTURE_TEXT.zh;
    const clip = custWrap.querySelector('.cust-clip');
    if (clip && current && !custWrap.dataset.face) {
      clip.animate([{ transform: 'scale(1,1)' }, { transform: `scale(${1.1 + n * 0.03},${0.86 - n * 0.03}) translateX(${n % 2 ? 3 : -3}%)` }, { transform: 'scale(1,1)' }],
        { duration: 160, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    }
    const p = Number.isFinite(x) ? { x, y } : (() => { const r = relRect(custWrap); return { x: r.x + r.w * 0.5, y: r.y + r.w * 0.2 }; })();
    paEl?.remove();
    const pa = el('div', 'g-pa', fx, gt.slap);
    paEl = pa;
    pa.dataset.n = String(Math.min(3, n));
    Object.assign(pa.style, { left: p.x + 'px', top: p.y + 'px' });
    pa.style.setProperty('--rot', `${(n % 2 ? -1 : 1) * (6 + Math.min(3, n) * 2)}deg`);
    if (n >= 3) el('i', 'g-pa-ring', pa);
    later(() => { pa.remove(); if (paEl === pa) paEl = null; }, 520);
    shake(2 + Math.min(4, n), 60, [n % 2 ? 1 : -1, 0]);
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
  // the stamp slams and leaves a red "兩個月" mark on the forehead: the mark is the prop, no caption (9). The old
  // caption argument is ignored.
  function stampSlam() {
    if (stampEl.hidden) { stampHold(0); }
    stampEl.classList.remove('in');
    restart(stampEl, 'slam');
    later(() => stampHold(null), 260);
    const r = relRect(custWrap);
    const mark = el('div', 'g-stamp-mark', fx, STAMP_MARK[lang] || STAMP_MARK.zh);
    Object.assign(mark.style, { left: r.x + r.w * 0.5 + 'px', top: r.y + r.w * 0.16 + 'px' });
    later(() => mark.remove(), 900);
    shake(8, 160, [0, 1]);
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

  // the queue at the right edge: a fling that way knocks over 1–3 of them. No "STRIKE" text (9): the silhouettes
  // topple one after another, the camera leans right, the caller plays the pin sound.
  function bowl(n = 1) {
    const pins = [...pinsEl.querySelectorAll('.g-pin')];
    const k = Math.max(0, Math.min(3, n));
    pins.slice(0, k).forEach((p, i) => {
      p.style.setProperty('--d', `${120 + i * 70}ms`);
      restart(p, 'down');
      later(() => p.classList.remove('down'), 1300);
    });
    if (k > 0) later(() => camNudge([62, 40], 1 + k * 0.015, 380), 120);
    if (k >= 3) {
      later(() => shake(6, 220, [1, 0]), 260);
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

  // A hint for the hand: the words ("連拍三下！") once per key (day 1 keeps it once, 9), after that the finger shows
  // it: three taps on the face with three ripples (閉嘴), a fling (滾), a hold (收). gestureHint('rage'): the finger
  // sweeps one long stroke across the rage row (the first rage, no words).
  const hintedOnce = new Set();
  function gestureHint(key, text) {
    const gt = GESTURE_TEXT[lang] || GESTURE_TEXT.zh;
    const c = chips[key]?.c;
    if (c) { restart(c, 'hint-flash'); later(() => c.classList.remove('hint-flash'), 420); }
    if (key !== 'rage' && !hintedOnce.has(key) && (text || gt.hint[key])) {
      hintedOnce.add(key);
      const t = el('div', 'g-hint', fx, text || gt.hint[key]);
      t.dataset.key = key;
      later(() => t.remove(), 1100);
      return;
    }
    fingerDemo(key);
  }
  function fingerDemo(key) {
    const box = key === 'rage' ? relRect(rageRow) : relRect(custWrap);
    const f = el('div', 'finger finger-demo', fx);
    html(f, art.FINGER_SVG);
    f.dataset.g = key === 'rage' ? 'sweep' : key;
    const at = key === 'rage' ? { x: box.x + box.w * 0.08, y: box.y + box.h * 0.45 } : { x: box.x + box.w * 0.5, y: box.y + box.w * 0.22 };
    Object.assign(f.style, { left: at.x + 'px', top: at.y + 'px' });
    if (key === 'shut') {
      for (let i = 0; i < 3; i++) {
        const r = el('i', 'g-ripple', fx);
        Object.assign(r.style, { left: at.x + 'px', top: at.y + 'px', animationDelay: i * 240 + 'ms' });
        later(() => r.remove(), 760 + i * 240);
      }
    }
    later(() => f.remove(), key === 'rage' ? 1400 : 1000);
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
  let camGen = 0; // bumped by every camera() call: a punch-in only returns if nobody moved the camera meanwhile
  let camBase = { f: FOCUS.WIDE, s: 1 }; // where camera() put it: punch-ins and nudges always return here
  function camera(focus = 'WIDE', scale = 1, ms = 0, ease) {
    camGen++;
    const t = camMove(focus, scale, ms, ease);
    camBase = { f: camState.f, s: camState.s };
    return t;
  }
  function camMove(focus, scale, ms, ease) {
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

  // A short camera lean that comes back by itself (bowling: toward the queue), unless someone moved the camera since.
  let camPunchT = 0;
  function camNudge(focus, scale, ms = 360) {
    const g = camGen, { f, s: s0 } = camBase;
    camMove(focus, s0 * scale, Math.round(ms * 0.35));
    clearTimeout(camPunchT);
    camPunchT = later(() => { if (g === camGen) camMove(f, s0, Math.round(ms * 0.65)); }, Math.round(ms * 0.35));
  }
  // The punch-in of the three beats (8.4): hard push-in on the hit, 240 ms back once the clerk is professional again.
  // Always relative to the resting camera (camBase), so quick repeated hits (rage) never ratchet the zoom.
  function camPunch(tier) {
    const g = camGen, { f, s: s0 } = camBase;
    const focus = tier.focus ? FOCUS[tier.focus] : f;
    camMove(focus, Math.max(s0, 1) * tier.zoom, 60);
    clearTimeout(camPunchT);
    camPunchT = later(() => { if (g === camGen) camMove(f, s0, 240); }, 60 + tier.freeze + 120);
  }

  // 40 ms white flash (big FX only; the opening's 調你媽 may pass longer). Off with reduced motion.
  function flash(ms = 40) {
    if (reduced) return;
    flashEl.animate([{ opacity: 0 }, { opacity: 0.85, offset: Math.min(0.4, 20 / ms) }, { opacity: 0.85, offset: ms > 60 ? 0.55 : 0.4 }, { opacity: 0 }], { duration: ms, easing: 'linear' });
  }

  // Thin cream speed lines on the outer 30% of the screen only (centre clear), at most 400 ms (8.1). Off with reduced
  // motion and in lite mode.
  function speedLines(ms = 300) {
    if (reduced || lite) return;
    const d = Math.min(400, Math.max(160, ms));
    const n = el('div', 'speedlines', shaker);
    n.animate([{ opacity: 0, transform: 'scale(1.12)' }, { opacity: 1, transform: 'scale(1)', offset: 0.2 }, { opacity: 1, offset: 0.6 }, { opacity: 0, transform: 'scale(1.03)' }], { duration: d, easing: 'ease-out', fill: 'forwards' });
    later(() => n.remove(), d);
  }

  // Directional shake (8.1): two decaying swings along dir (the way the customer flies), not a random jitter.
  // Without dir it swings sideways with a little lift. Halved with reduced motion.
  let lastDir = [1, 0.25];
  function shake(px = 6, ms = 200, dir) {
    const a = reduced ? px / 2 : px;
    const [ux, uy] = (() => {
      const d = Array.isArray(dir) ? dir : dir && Number.isFinite(dir.x) ? [dir.x, dir.y] : lastDir;
      const len = Math.hypot(d[0], d[1]) || 1;
      return [d[0] / len, d[1] / len];
    })();
    const frames = [{ transform: 'translate(0,0)' }];
    // out, back past zero, out (smaller), back: 2 decaying swings
    for (const k of [1, -0.6, 0.35, -0.15]) frames.push({ transform: `translate(${(ux * a * k).toFixed(1)}px, ${(uy * a * k).toFixed(1)}px)` });
    frames.push({ transform: 'translate(0,0)' });
    shaker.animate(frames, { duration: ms, easing: 'ease-out' });
  }

  // One FX hit at a level (8.1): hit-stop, directional shake, camera punch-in, particles, and for 'big' a 40 ms flash
  // and thin speed lines. key picks the direction and the particle ('gun' | 'gun2' | 'shut' | 'take').
  function punchFx(level = 'small', key) {
    const tier = FX_TIER[TIER_OF[level] || 'small'];
    const dir = FLY_DIR[key] || lastDir;
    if (FLY_DIR[key]) lastDir = dir;
    if (!lite) freeze(tier.freeze);
    later(() => shake(tier.shake, tier.ms, dir), lite ? 0 : tier.freeze);
    camPunch(tier);
    if (tier.flash) flash(tier.flash);
    if (tier.lines) speedLines(tier.lines);
  }

  let freezeTimer = 0;
  let frozen = [];
  function freeze(ms = 60) {
    clearTimeout(freezeTimer);
    const anims = typeof stage.getAnimations === 'function' ? stage.getAnimations({ subtree: true }) : [];
    // hit-stop: the world stops; the 花字 caption and the subtitle keep playing (a paused fade-in would hide the line)
    frozen = anims.filter((a) => a.playState === 'running' && !a.effect?.target?.closest?.('.hz-layer, .subs, .karaoke'));
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
  // The three beats, performed (8.4) — never written on screen:
  //   1 setup: the polite / smug face (idle + squint), the subtitle's setup words alone;
  //   2 punch: hard cut to the yell (0 ms), hit-stop, directional shake + camera punch-in (punchFx at the fx level),
  //     the punch words appear in the key colour and grow 1.25 → 1;
  //   3 snap back: 120 ms after the hit-stop a hard cut to the professional face (tidy), the camera returns in 240 ms.
  // fx 'normal' | 'curse' | 'mega' = small | medium | big (8.1); key = the answered key (colour, direction, particles;
  // defaults to the key whose sign just left). shake / flash override the level's numbers (legacy callers).
  let beatTimers = [];
  let beatActive = false;
  let beatTier = 'small';  // the level of the current answer: customerReact() sizes its particles with it
  let lastExitKey = null;  // signOut(face): the key of the last answer
  function clerkBeat({ setupMs = 0, punchStartMs, punchMs = 600, landMs = 650, shake: sh, flash: fl, fx: kind, key } = {}) {
    beatTimers.forEach(clearTimeout);
    beatTimers = [];
    clearTimeout(moodTimer);
    beatActive = true;
    const ps = Math.max(0, punchStartMs ?? setupMs);
    const at = (ms, fn) => beatTimers.push(setTimeout(fn, Math.max(0, ms)));
    const level = TIER_OF[kind] || 'small';
    beatTier = level;
    const tier = FX_TIER[level];
    const punchEl = subPunch;
    if (ps > 0) {
      setClerk('idle');
      setClerkFlags({ squint: true });
      punchEl?.classList.add('wait'); // the punch words wait for the punch
    }
    at(ps, () => {
      const k = key || lastExitKey;
      setClerkFlags({ squint: false });
      setClerk('hit');
      if (sh != null || fl != null) {
        if (sh) shake(sh, 200, FLY_DIR[k]);
        if (fl) flash();
        if (!lite) freeze(tier.freeze);
      } else punchFx(level, k);
      if (punchEl && punchEl.isConnected) {
        if (PUNCH_COLOR[k]) punchEl.style.setProperty('--pc', PUNCH_COLOR[k]);
        punchEl.classList.remove('wait');
        punchEl.classList.remove('hit', 'hit-medium', 'hit-big');
        void punchEl.offsetWidth;
        punchEl.classList.add('hit');
        if (level !== 'small') punchEl.classList.add('hit-' + level);
      }
    });
    at(ps + (lite ? 0 : tier.freeze) + 120, () => {
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

  // The speed multiplier is no longer written on the sign (art-direction-v2 9: no "×2 / ×1.5" tags). Its reward is
  // the hit level and the size of the flying +N; the sign timer's gold fast window (A) shows when it pays most.
  // Kept as no-ops so older callers keep working.
  function paintMult() { sign?.querySelector('.sign-mult')?.remove(); }
  function setSignMult() { /* no-op (9) */ }
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
    if (FLY_DIR[face]) lastExitKey = face;
    exit250 = sign.classList.contains('is-250');
    if (face === 'take' || sign.classList.contains('is-250')) signStampFx(sign, face);
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
      reactParticles(face, fl);
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

  // Jab (gameplay-v2 3): the flying customer gets kicked again: 40% farther per kick (+180° for 滾), the small FX
  // level (directional shake, 40 ms hit-stop, a few particles). No word (8.3: S4 is symbols only, 補刀 is a small hit).
  // A customer not flying yet (the clerk is still in the setup) wobbles instead. The word option is ignored.
  const KICK = { gun: [-36, -20, -180], gun2: [-22, -34, -180], shut: [0, 14, 0], take: [32, -3, 0] };
  function kick(face, { n = 1 } = {}) {
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
    const k = FLY_DIR[custWrap.dataset.face] ? custWrap.dataset.face : face;
    shake(4, 80, FLY_DIR[k]);
    if (!lite) freeze(40);
    if (n <= 3) emitParticles(PARTICLE_OF[k] || 'ice', 3, particleOrigin(k), FLY_DIR[k]);
  }

  function setForced(on) {
    stage.classList.toggle('forced', !!on);
    stage.classList.toggle('polite', !!on);
    setClerk(on ? 'polite' : 'idle');
  }

  // ---------- Particles (8.2): pure CSS transforms on a pool of at most 12 nodes; none in lite mode ----------
  const PT_MAX = 12;
  const ptPool = [];
  let exit250 = false;
  function ptNode(kind) {
    let n = ptPool.find((p) => !p._busy);
    if (!n) {
      if (ptPool.length >= PT_MAX) return null;
      n = el('i', 'pt', ptLayer);
      ptPool.push(n);
    }
    n._busy = true;
    n.className = 'pt pt-' + kind;
    // A's PARTICLE_SVG (3 nodes each) for the few-at-a-time kinds; the 10 gold cups stay CSS (SVG node budget)
    const svg = kind !== 'cup' && art.PARTICLE_SVG && art.PARTICLE_SVG[kind];
    n.innerHTML = svg || (kind === 'stamp' ? '<b>250</b>' : '');
    if (svg) n.classList.add('has-svg');
    n.style.display = 'block';
    return n;
  }
  function ptFree(n) { n._busy = false; n.style.display = 'none'; n.textContent = ''; }
  // origin of an answer's particles (stage px): the customer's face, or the sign for 收
  function particleOrigin(key) {
    if (key === 'take' && sign && sign.isConnected) { const r = relRect(sign.querySelector('.sign-card') || sign); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
    const r = relRect(custWrap);
    return { x: r.x + r.w * 0.5, y: r.y + r.w * 0.28 };
  }
  // kind 'ice' | 'pearl' | 'ink' | 'paper' | 'cup' | 'stamp'; dir = [x, y] the way the customer flies
  function emitParticles(kind, n, at, dir = [0, -1]) {
    if (lite || !(n > 0) || !at) return;
    const W = stage.clientWidth || 360;
    const u = W / 100; // 1cqw in px
    const [dx, dy] = dir;
    for (let i = 0; i < n; i++) {
      const p = ptNode(kind);
      if (!p) return;
      p.style.left = at.x + 'px';
      p.style.top = at.y + 'px';
      const j = (i / Math.max(1, n - 1)) - 0.5; // -0.5 .. 0.5 spread
      const rnd = (a) => (Math.random() * 2 - 1) * a;
      let frames, ms;
      if (kind === 'ice' || kind === 'cup') {
        const sp = (kind === 'cup' ? 30 : 34) * u * (0.7 + Math.random() * 0.5);
        const ang = Math.atan2(dy, dx) + j * (kind === 'cup' ? 2.6 : 1.1) + rnd(0.15);
        const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp - (kind === 'cup' ? 14 * u : 0);
        const r = rnd(360);
        frames = [
          { transform: 'translate(-50%,-50%) scale(.6) rotate(0deg)', opacity: 1 },
          { transform: `translate(calc(-50% + ${(vx * 0.6).toFixed(1)}px), calc(-50% + ${(vy * 0.6).toFixed(1)}px)) scale(1) rotate(${(r * 0.6).toFixed(0)}deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(calc(-50% + ${vx.toFixed(1)}px), calc(-50% + ${(vy + 26 * u).toFixed(1)}px)) scale(.9) rotate(${r.toFixed(0)}deg)`, opacity: 0 },
        ];
        ms = kind === 'cup' ? 900 : 560;
      } else if (kind === 'pearl') {
        const x = (j * 16 + rnd(3)) * u, drop = (16 + Math.random() * 6) * u;
        frames = [
          { transform: 'translate(-50%,-50%)', opacity: 1, easing: 'cubic-bezier(.5,0,1,.6)' },
          { transform: `translate(calc(-50% + ${(x * 0.7).toFixed(1)}px), calc(-50% + ${drop.toFixed(1)}px))`, offset: 0.5, easing: 'cubic-bezier(0,.4,.5,1)' },
          { transform: `translate(calc(-50% + ${(x * 0.85).toFixed(1)}px), calc(-50% + ${(drop - 5 * u).toFixed(1)}px))`, offset: 0.7, easing: 'cubic-bezier(.5,0,1,.6)' },
          { transform: `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${drop.toFixed(1)}px))`, opacity: 1, offset: 0.88 },
          { transform: `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${drop.toFixed(1)}px))`, opacity: 0 },
        ];
        ms = 700;
      } else if (kind === 'ink' || kind === 'stamp') {
        const r = kind === 'stamp' ? -12 : rnd(25);
        frames = [
          { transform: `translate(-50%,-50%) scale(${kind === 'stamp' ? 2.2 : 1.8}) rotate(${r}deg)`, opacity: 0 },
          { transform: `translate(-50%,-50%) scale(.92) rotate(${r}deg)`, opacity: 1, offset: 0.14 },
          { transform: `translate(-50%,-50%) scale(1) rotate(${r}deg)`, opacity: 1, offset: 0.7 },
          { transform: `translate(-50%,-50%) scale(1) rotate(${r}deg)`, opacity: 0 },
        ];
        ms = kind === 'stamp' ? 900 : 620;
      } else { // paper: a receipt strip pushed out from under the sign
        frames = [
          { transform: 'translate(-50%, 10%) scaleY(.1) rotate(0deg)', opacity: 1, transformOrigin: '50% 100%' },
          { transform: 'translate(-50%, -40%) scaleY(1) rotate(-4deg)', opacity: 1, offset: 0.45 },
          { transform: `translate(calc(-50% + ${(8 * u).toFixed(1)}px), -120%) scaleY(1) rotate(10deg)`, opacity: 0 },
        ];
        ms = 760;
      }
      const a = p.animate(frames, { duration: ms, delay: kind === 'cup' ? i * 18 : 0, easing: 'linear', fill: 'both' });
      a.onfinish = a.oncancel = () => ptFree(p);
    }
  }
  const PT_COUNT = { small: [3, 5], medium: [6, 8], big: [10, 10] };
  function reactParticles(face, fling) {
    const range = PT_COUNT[beatTier] || PT_COUNT.small;
    const n = range[0] + Math.round(Math.random() * (range[1] - range[0]));
    const dir = fling && fling.dir ? [fling.dir.x, fling.dir.y] : FLY_DIR[face];
    if (face === 'gun' || face === 'gun2') emitParticles('ice', n, particleOrigin(face), dir);
    else if (face === 'shut') emitParticles('pearl', Math.max(2, Math.round(n / 2)), particleOrigin('shut'), dir);
    if (exit250) { exit250 = false; emitParticles('cup', 10, particleOrigin(face), [0, -1]); }
  }
  // 收 (and any 250 sign): a red ink blot is stamped on the sign and a receipt strip comes out under it; a 250 gets the
  // gold stamp (8.2)
  function signStampFx(node, face) {
    const card = node.querySelector('.sign-card') || node;
    const r = relRect(card);
    if (!r.w) return;
    const at = { x: r.x + r.w * 0.55, y: r.y + r.h * 0.45 };
    if (node.classList.contains('is-250')) emitParticles('stamp', 1, at);
    else if (face === 'take') emitParticles('ink', 1, at);
    if (face === 'take') emitParticles('paper', 1, { x: r.x + r.w * 0.5, y: r.y + r.h });
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

  // ---------- Subtitles (art-direction-v2 7.7) ----------
  // One line at a time, no stage directions (the face and the sound act them out). A clerk line is split into the
  // setup (small, flat) and the punch (.sub-punch: 900 weight, bigger, in the answered key's colour): that size jump
  // inside one line IS the 反差 — nothing on screen names it. clerkBeat() holds the punch back until the punch beat
  // (.wait) and pops it in (.hit, 1.25 → 1). color sets the punch colour now ('gun' | 'shut' | 'take').
  let subPunch = null;
  function showLine(text, { style = '', who = 'clerk', color } = {}) {
    last.lineWho = who;
    const node = el('div', `sub sub-${who} st-${style || 'plain'}`);
    if (who === 'cust') node.style.setProperty('--bar', keyColor(color || 'gun'));
    subPunch = null;
    if (who === 'clerk') {
      const { setup, punch } = subtitleParts(text);
      if (setup) el('span', 'say sub-setup', node, setup);
      if (punch) {
        subPunch = el('span', 'say sub-punch', node, punch);
        // the answered sign's colour (the sign may be leaving: its kind stays on the element); not for service lines
        const signKey = sign && (/\bsign-(gun|shut|take)\b/.exec(sign.getAttribute('class') || '') || [])[1];
        const k = color || (style !== 'polite' ? signKey : null);
        if (PUNCH_COLOR[k]) subPunch.style.setProperty('--pc', PUNCH_COLOR[k]);
      }
    } else {
      const spoken = stripStage(String(text ?? '').replace(/\s*\|\s*/g, (m) => (/[A-Za-z]/.test(String(text)) ? ' ' : '')));
      if (spoken) el('span', 'say', node, spoken);
    }
    subs.textContent = '';
    subs.appendChild(node);
    // Max 2 lines: 5.4cqw, or `.long` (4.2cqw) when that does not fit.
    // offsetHeight, not scrollHeight: the line's slide-in transform must not count as overflow
    if (node.offsetHeight > subs.clientHeight + 2 || node.getClientRects().length > 2) node.classList.add('long');
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

  // 8.3 looks (stroke widths in cqw: the layer is 100 units wide). S1 = lemon face, 1.6 gun-deep inner + 2.8 ink outer
  // stroke (was 2.6 / 4.6); S2 = gold gradient + ink stroke + one sheen; S4 = a symbol in a cream bubble; S5 = typed.
  // Default spot: the clerk's chest to the counter top (y 34–46%), never across his eyes to mouth (y 17–31%).
  const HZ = {
    S1: { fill: '#FFD84A', inner: ['#B42A1E', 1.6], outer: ['#1B1311', 2.8], pos: [50, 40], weight: 900 },
    S2: { fill: 'url(#hzGold)', inner: null, outer: ['#1B1311', 2.6], pos: [50, 38], weight: 900 },
    S4: { fill: '#1B1311', inner: null, outer: null, pos: [75, 52], weight: 700, font: FONT_SIGN },
    S5: { fill: '#FFF7E6', inner: null, outer: ['#1B1311', 2.2], pos: [50, 42], weight: 900 },
  };
  const HZ_FACE_BAND = [17, 31]; // stage %: the clerk's eyes to mouth

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
    const family = latin && style !== 'S4' ? HZ_FONT_EN : def.font || FONT_ZH;
    const base = { 'font-family': family, 'font-weight': latin && style !== 'S4' ? 800 : def.weight, 'font-size': fs, 'text-anchor': anchor, 'dominant-baseline': 'central', 'paint-order': 'stroke', 'stroke-linejoin': 'round', x: 0, y: 0 };
    const nodes = [];
    if (def.outer) nodes.push(svgEl('text', { ...base, fill: def.outer[0], stroke: def.outer[0], 'stroke-width': def.outer[1], class: 'hz-out' }, parent));
    nodes.push(svgEl('text', { ...base, fill: def.fill, stroke: def.inner ? def.inner[0] : 'none', 'stroke-width': def.inner ? def.inner[1] : 0, class: 'hz-in', id }, parent));
    for (const n of nodes) n.textContent = text;
    return nodes;
  }

  // One 花字 at a time (8.3): a new one ends the one on screen; they start at least HZ_GAP_MS apart (huazi()).
  let lastHzAt = -Infinity;
  function hzOne(itemIn) {
    const item = { ...itemIn, style: normStyle(itemIn.style) };
    if (item.style === 'emph') { emphasize([item.text]); return Promise.resolve(); }
    const def = HZ[item.style];
    if (!def || !isAllowedHuazi(item)) return Promise.resolve(); // S3 is gone; S1/S2 only for the signature words
    let text = String(item.text || '');
    // S4 is the customer's inner voice in a bubble: symbols only ('？？？', '！', '…'), never words (8.3)
    let mark = null;
    if (item.style === 'S4') ({ text, mark } = s4Symbol(text));
    for (const live of [...liveHz]) live._done?.();
    lastHzAt = performance.now();
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
    const anchor = 'middle';
    let fs = hzFontSize(item.style, text, { size: item.size, fontSize: item.fontSize, latin });
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
    const extra = item.style === 'S2' || item.style === 'S1' ? 2.5 : item.style === 'S4' ? 2 : 1;
    let box = { x0: bb.x - strokePad - extra, y0: bb.y - strokePad - extra, x1: bb.x + bb.width + strokePad + extra, y1: bb.y + bb.height + strokePad + extra };
    if (item.style === 'S4') box.x1 += 6;
    if (item.style === 'S5') box.y1 += 3;
    // keep clear of the sign and of the clerk's face: below the face first (chest → counter), else above it
    const k = geo.unitsPerStagePct;
    const signBox = signBoxUnits();
    const minSize = Math.min(9, fs);
    const faceFree = item.style === 'S4'; // S4 sits by the customer (a scripted pos is only the starting point)
    const placed = faceFree
      ? placeHuazi({ box, cx, cy, size0: fs, sign: signBox, gap: 4, top: 8 * k, bottom: geo.H, minSize })
      : placeHuazi({ box, cx, cy: Math.max(cy, HZ_FACE_BAND[1] * k - box.y0), size0: fs, sign: signBox, gap: 6, top: HZ_FACE_BAND[1] * k, bottom: geo.H, minSize })
        || placeHuazi({ box, cx, cy: Math.min(cy, HZ_FACE_BAND[0] * k - box.y1), size0: fs, sign: signBox, gap: 4, top: 8 * k, bottom: HZ_FACE_BAND[0] * k, minSize })
        // a tall sign still rising (the opening's gold 250) leaves no room off the face: the signature word still shows
        || placeHuazi({ box, cx, cy, size0: fs, sign: signBox, gap: 6, top: 8 * k, bottom: geo.H, minSize });
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
    const total = run ? run({ svg, anim, deco, nodes, inner, lb, fs, item, text, textId, id, maxScale, mark }) : 1000;
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
    S1({ anim, lb, item, maxScale }) {
      // slams in from 1.8 (was 2.6: a fat caption over the clerk's face); the screen-level speed lines belong to the
      // big FX level, not to every S1
      const s0 = Math.min(1.8, maxScale).toFixed(2);
      const sOut = Math.min(1.15, maxScale).toFixed(2);
      const sPiece = Math.min(1.2, maxScale).toFixed(2);
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
    S2({ svg, anim, deco, lb, textId, id, text }) {
      // the rays only behind a bare 250 / 251 / 520 (8.3); 黃金比例最好喝 gets the sheen alone
      if (/^[\d,]+杯?$|^\d+ ?cups?$/i.test(text)) {
        const r = Math.hypot(lb.w, lb.h) / 2 + 2;
        const ray = rays(deco, 12, r, '#FFD23A', 0.35);
        deco.parentNode.insertBefore(deco, deco.parentNode.firstChild);
        if (!lite) ray.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 2000, iterations: Infinity });
      }
      // White sheen sweeping across the glyphs at 300 ms.
      const sc = svgEl('clipPath', { id: `hzs${id}` }, svg);
      svgEl('use', { href: `#${textId}` }, sc);
      const sg = svgEl('g', { 'clip-path': `url(#hzs${id})` }, anim);
      const sheen = svgEl('g', { class: 'hz-sheen' }, sg);
      svgEl('rect', { x: lb.x0 - 10, y: lb.y0, width: 6, height: lb.h, fill: '#FFFFFF', opacity: 0.75, transform: `skewX(-20)` }, sheen);
      sheen.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${lb.w + 20}px)` }], { duration: 400, delay: 300, fill: 'both' });
      // Four 4-point stars twinkling around the box.
      for (let i = 0; i < 4; i++) {
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
    S4({ anim, deco, lb, nodes, mark }) {
      // cream thought bubble behind the text, with two small circles trailing down-left toward the customer
      const bub = svgEl('g', { class: 'hz-bubble' });
      anim.insertBefore(bub, nodes[0]);
      svgEl('rect', { x: lb.x0 + 0.6, y: lb.y0 + 0.4, width: lb.w - 7, height: lb.h - 0.8, rx: Math.min(4, lb.h / 2), fill: '#FFF4DC', stroke: '#1B1311', 'stroke-width': 0.7 }, bub);
      svgEl('circle', { cx: lb.x0 + 3, cy: lb.y1 + 1.2, r: 1.3, fill: '#FFF4DC', stroke: '#1B1311', 'stroke-width': 0.6 }, bub);
      svgEl('circle', { cx: lb.x0 + 0.8, cy: lb.y1 + 3.2, r: 0.8, fill: '#FFF4DC', stroke: '#1B1311', 'stroke-width': 0.5 }, bub);
      const dx = lb.x1 - 4, dy = lb.y0 + 3;
      if (mark === 'sparkle') {
        for (const [ox, oy, r] of [[0, 0, 2.2], [2.6, 3.2, 1.3]]) {
          const x = dx + ox, y = dy + oy;
          svgEl('path', { d: `M${x} ${y - r}L${x + r / 3} ${y - r / 3}L${x + r} ${y}L${x + r / 3} ${y + r / 3}L${x} ${y + r}L${x - r / 3} ${y + r / 3}L${x - r} ${y}L${x - r / 3} ${y - r / 3}Z`, fill: '#FFD84A', stroke: '#1B1311', 'stroke-width': 0.4 }, anim);
        }
      } else if (mark === 'sweat' || mark === 'q') {
        svgEl('path', { d: `M${dx} ${dy - 3} Q${dx + 2.4} ${dy + 0.6} ${dx + 1.4} ${dy + 2} Q${dx} ${dy + 3} ${dx - 1.4} ${dy + 2} Q${dx - 2.2} ${dy + 0.6} ${dx} ${dy - 3}Z`, fill: '#9ED8FF', stroke: '#1B1311', 'stroke-width': 0.6 }, anim);
      }
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

  // 8.3: only the allowed 花字 survive (S3 never; S1 / S2 only signature words or big-level items; others are dropped,
  // the subtitle's punch carries them); at most one on screen, HZ_GAP_MS apart.
  function huazi(list = [], timing = {}) {
    const items = (Array.isArray(list) ? list : [list]).filter((x) => x && x.text && isAllowedHuazi({ ...x, style: normStyle(x.style) }));
    const setupStart = timing.setupStartMs ?? 0;
    const setupMs = timing.setupMs ?? 0;
    const punchStart = timing.punchStartMs ?? setupStart + setupMs;
    const punchMs = timing.punchMs ?? 0;
    const minAt = timing.minAt ?? 0;
    // Start times: S4 at segment start, others at start + clip × ratio, ≥ HZ_GAP_MS apart.
    const raw = items.map((it) => {
      if (it.at != null) return it.at;
      const st = normStyle(it.style);
      const start = it.seg === 'setup' ? setupStart : punchStart;
      if (st === 'S4') return start;
      return start + (it.seg === 'setup' ? setupMs : punchMs) * (it.ratio || 0);
    });
    let prev = -Infinity;
    const times = raw.map((t, i) => ({ t, i })).sort((a, b) => a.t - b.t).reduce((acc, { t, i }) => {
      const st = normStyle(items[i].style);
      acc[i] = st === 'emph' ? Math.max(t, minAt) : Math.max(t, prev + HZ_GAP_MS, minAt);
      if (st !== 'emph') prev = acc[i];
      return acc;
    }, []);
    let cancelled = false;
    const handles = [];
    const batch = { cancel: () => api.cancel() };
    // when the last item of this batch is gone (ms from now), so callers can keep the next customer out of it
    const DUR = { S1: 1000, S2: 1500, S4: 1300, S5: 1600, emph: 0 };
    const endMs = items.reduce((m, it, i) => {
      const st = normStyle(it.style);
      const d = st === 'S1' && it.ms ? Math.max(1000, it.ms) : st === 'S5' ? 160 + [...String(it.text)].length * (it.charMs ?? 60) + (it.holdMs ?? 600) + 160 : DUR[st] ?? 1000;
      return Math.max(m, (times[i] || 0) + d);
    }, 0);
    hzBatches.add(batch);
    const promises = items.map((it, i) => new Promise((resolve) => {
      const entry = { h: 0, resolve };
      const go = () => {
        if (cancelled) return resolve();
        // the previous 花字 (any batch) started less than HZ_GAP_MS ago: wait for the gap
        const wait = normStyle(it.style) === 'emph' ? 0 : lastHzAt + HZ_GAP_MS - performance.now();
        if (wait > 0) { entry.h = later(go, wait); return; }
        hzOne(it).then(resolve);
      };
      entry.h = later(go, times[i] || 0);
      handles.push(entry);
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
      if (phase === 'over') { setClerk('over'); stopSignTimer(); clearGuide(); }
      else if (phase !== 'rage' && clerk.dataset.mood === 'rage') setClerk('idle');
    }
    if (phase !== 'idle') queueOverride = false;
    if (!queueOverride) paintQueue(Math.floor(state.queue || 0));
    setBar(auraBar, state.aura, 'aura');
    setBar(furyBar, state.fury, 'fury');
    const full = state.furyFull ? 'full' : '';
    if (stage.dataset.fury !== full) stage.dataset.fury = full;
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
  // One flying number at a time (art-direction-v2 0.2): a bonus that lands while the last +N is still taking off
  // (the voice 反差 bonus, a bowling strike) joins it and makes it one size bigger instead of a second number.
  let gainLive = null; // { el, n, at }
  function queueGain(n) {
    if (!(n > 0) || reduced) { if (n > 0) restart(qNum, 'bump'); return; }
    if (gainLive && gainLive.el.isConnected && performance.now() - gainLive.at < 420) {
      gainLive.n += n;
      gainLive.el.textContent = '+' + fmt(gainLive.n);
      gainLive.el.classList.add('big');
      return;
    }
    const f = el('div', 'gain-fly', fx, '+' + fmt(n));
    gainLive = { el: f, n, at: performance.now() };
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
        // rage hits and other quick hits: the small level (a matching rage key: medium)
        const level = (payload.charge | 0) >= 2 ? 'medium' : 'small';
        if (phase !== 'rage' && !beatActive) clerkBeat({ punchStartMs: 0, punchMs: 300, landMs: 300, fx: level, key: payload.key });
        else punchFx(level, payload.key);
        break;
      }
      case 'charge': {
        // the hold builds up; the hit itself (clerkBeat at the big level) gets the flash
        const lvl = Math.max(1, Math.min(2, payload.charge ?? payload.level ?? 1));
        if (lvl === 2) setClerk('rage', 700);
        shake(lvl === 2 ? 8 : 4, 200);
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
        // the boos are small speech bubbles popping out of the queue at the right (7.10), at most 2
        const boos = (payload.boo && payload.boo.length ? payload.boo : DECOR[lang].boo).slice(0, 2);
        boos.forEach((t, i) => {
          const n = floatText(t, 'boo-text', 1600);
          n.style.setProperty('--row', String(i));
          n.style.animationDelay = i * 260 + 'ms';
        });
        break;
      }
      case 'rageStart':
        // no "爆氣！" caption (9): the red edge vignette (.stage.rage .fx-edge), the swinging lamps, the clerk's rage
        // face and the heads rushing in say it; the start is a big FX hit
        stage.classList.add('rage');
        setClerk('rage');
        stopSignTimer();
        punchFx('big');
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
  let milestoneText = null;
  let milestoneTextEl = null;
  const resolveText = (t) => (typeof t === 'function' ? t() : t) || '';
  function showMilestone(level, text) {
    bigFx.push(() => {
      monitorMarkup = '';
      paintMonitor(Math.max(level, last.queue || 0));
      // art contract: data-zoom on .monitor = 260 ms zoom to x 4–96% / y 8–40%, 900 ms parallax, 260 ms back.
      monitor.dataset.zoom = '1';
      milestoneCard.textContent = '';
      const card = el('div', 'ms-card', milestoneCard);
      card.dataset.scene = monitor.dataset.scene || '';
      el('div', 'ms-level', card, fmt(level) + '+');
      milestoneText = text;
      milestoneTextEl = el('div', 'ms-text', card, resolveText(text));
      milestoneCard.classList.remove('hidden');
      return () => {
        milestoneCard.classList.add('hidden');
        if (monitor) delete monitor.dataset.zoom;
        milestoneText = null;
        milestoneTextEl = null;
      };
    }, 1420);
  }
  function relabelMilestone() {
    if (milestoneTextEl && milestoneText != null) milestoneTextEl.textContent = resolveText(milestoneText);
  }

  // ---------- Screens ----------
  function hideOverlays() {
    startCard.classList.add('hidden');
    summaryCard.classList.add('hidden');
    overlayTap = null;
    syncLock();
  }

  let fontsPromise = Promise.resolve();
  function preloadFonts() {
    try {
      if (!document.fonts?.load) return;
      fontsPromise = Promise.all([
        document.fonts.load('900 1em "Noto Sans TC"', '滾閉嘴收調你媽250'),
        document.fonts.load('700 1em "LXGW WenKai TC"', '嗯杯少甜冰'),
        document.fonts.load('1em "Bangers"', 'SCRAM250'),
      ]).catch(() => {});
    } catch { /* no font loading API */ }
  }
  function fontsReady(maxMs = 300) {
    return Promise.race([fontsPromise, new Promise((r) => setTimeout(r, maxMs))]);
  }

  // Start page (3.2): 0–600 ms title slams down, 600–1200 ms tagline fades in, from 1200 ms the whole
  // screen is tappable and the big button breathes. Background: the clerk's disdain face, camera 1.15 on FACE.
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
    const h1 = el('h1', 'start-title', startCard);
    for (const part of title.split(/(\d+)/).filter(Boolean)) {
      if (/^\d+$/.test(part)) el('span', 'num', h1, part);
      else h1.appendChild(document.createTextNode(part));
    }
    el('p', 'start-tag', startCard, t.subtitle || d.sub);
    if (t.dayTitle || t.rule) {
      // stage 2 day card: "第 N 天 · 午休潮", the rule in one line, the ★3 riddle, the best so far
      const dc = el('div', 'start-day', startCard);
      if (t.dayTitle) el('div', 'sd-title', dc, t.dayTitle);
      if (t.rule) el('div', 'sd-rule', dc, t.rule);
      if (t.riddle) el('div', 'sd-riddle', dc, t.riddle);
      if (t.best || t.starMask) {
        const row = el('div', 'sd-best', dc);
        const st = el('span', 'sd-stars', row);
        for (let i = 0; i < 3; i++) el('i', (t.starMask >> i) & 1 ? 'on' : '', st, '★');
        if (t.best) el('span', '', row, t.best);
      }
    }
    const label = firstRun ? t.start || d.firstStart : typeof t.startDay === 'function' ? t.startDay(day) : t.startDay ? String(t.startDay).replace('{n}', day) : d.day(day);
    const btn = el('button', 'start-btn', startCard, label);
    btn.type = 'button';
    // controls toggle (docs/gameplay-v2.md 9): 手勢 / 按鍵; does not start the shop
    const gt = GESTURE_TEXT[lang] || GESTURE_TEXT.zh;
    const tog = el('div', 'input-tog', startCard);
    el('span', 'it-label', tog, gt.input);
    const vt = VOICE_TEXT[lang] || VOICE_TEXT.zh;
    for (const m of ['gesture', 'buttons', 'voice']) {
      const b = el('button', 'it-opt', tog, m === 'voice' ? vt.voice : gt[m]);
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
    };
    syncInputTog();
    if (!reduced) h1.animate([{ translate: '0 -30cqw', scale: '1.3', opacity: 0 }, { translate: '0 1cqw', scale: '.96', opacity: 1, offset: 0.75 }, { translate: '0 0', scale: '1', opacity: 1 }], { duration: 600, easing: 'cubic-bezier(.3,1.5,.5,1)', fill: 'backwards' });
    btn.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 1200, fill: 'backwards' });
    const since = performance.now();
    const go = () => {
      if (startCard.classList.contains('hidden')) return;
      // a tap before the button is in (1200 ms) used to be swallowed without feedback: it now starts too,
      // only a re-entry tap from the previous screen (< 150 ms) is ignored
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
    // face close-up at 1.15, framed from y 11% so the lightbox stays below the 中/EN · 消音 buttons (review)
    camera([50, 11], 1.15, 0);
    summaryCard.classList.add('hidden');
    startCard.classList.remove('hidden');
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
    const d = DECOR[lang];
    closingEl = el('div', 'day-card', stage);
    const inner = el('div', 'dc-inner', closingEl);
    const title = t.title || (lang === 'zh' ? '第一天 打烊' : 'Day 1 — Closed');
    const n = fmt(summary.queue);
    if (Array.isArray(summary.plate) && summary.plate.length) {
      const top = el('div', 'dc-top', inner);
      top.innerHTML = art.ticketHTML(summary.plate);
      const tk = top.firstElementChild;
      if (tk) tk.classList.add('dc-ticket');
      if (summary.bestLine) {
        const b = el('div', 'dc-best', top);
        el('div', 'dc-best-label', b, summary.bestLabel || (lang === 'zh' ? '今天最狠一句' : "Today's savagest line"));
        el('div', 'dc-best-line', b, summary.bestLine);
      }
    }
    const head = el('h2', 'dc-title', inner);
    el('span', 'dc-title-day', head, title);
    const q = el('span', 'dc-title-q', head);
    if (typeof t.queueFmt === 'function' || t.queueFmt) {
      q.textContent = typeof t.queueFmt === 'function' ? t.queueFmt('', n).replace(/^\s*[｜|]\s*/, '') : String(t.queueFmt).replace('{title}', '').replace('{n}', n).replace(/^\s*[｜|]\s*/, '');
    } else {
      // "門口排了 78 人" with the number in <b>
      const [pre, post] = d.queueFmt('', '\u0000').replace(/^\s*[｜|]\s*/, '').split('\u0000');
      q.append(pre);
      el('b', '', q, n);
      q.append(post);
    }
    const lines = t.lines || [];
    ['gun', 'shut', 'take'].forEach((k, i) => {
      const row = el('div', 'dc-row', inner);
      row.dataset.key = k;
      row.style.setProperty('--kc', keyColor(k));
      miniSign(row, k, MINI_TEXT[lang][k]);
      // "嗯……／杯數太少 → 滾": description left, key word right.
      const [desc, keyWord] = String(lines[i] || '').split(/\s*(?:→|->)\s*/);
      el('span', 'dc-text', row, desc || '');
      el('span', 'dc-key', row, keyWord || String(texts[k] || '').replace(/[！!]$/, ''));
    });
    loudestRow(inner, summary.loudest);
    const stars = el('div', 'dc-stars', inner);
    const got = summary.stars ?? ((summary.queue ?? 0) >= (summary.star1 ?? 30) ? 1 : 0);
    for (let i = 0; i < 3; i++) {
      const st = el('span', 'dc-star', stars);
      st.classList.toggle('on', i < got);
      st.style.animationDelay = i * 150 + 'ms';
      st.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7L12 17.4 5.8 21.1l1.6-7L2 9.3l7.1-.7z" fill="#FFD23F" stroke="#1B1311" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    }
    const btn = el('button', 'dc-btn', inner, t.next || (lang === 'zh' ? '開第二天 ▸' : 'Open day 2 ▸'));
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
    const b = el('button', 'big-btn', parent, label);
    b.type = 'button';
    b.addEventListener('click', () => { hideOverlays(); onStart(); });
    return b;
  }

  function showSummary(s = {}, t = {}) {
    bigFx.clear();
    clearGuide();
    const zh = lang === 'zh';
    summaryCard.textContent = '';
    const card = el('div', 'card report', summaryCard);
    el('div', 'report-stamp', card, zh ? '打烊' : 'CLOSED');
    el('h2', 'card-title', card, t.title || (zh ? '今日戰報' : "Today's Report"));
    const grid = el('div', 'report-grid', card);
    const stat = (label, val, cls = '') => {
      const c = el('div', 'stat ' + cls, grid);
      el('div', 'stat-val', c, val);
      el('div', 'stat-label', c, label);
    };
    stat(t.cursedLabel || (zh ? '開罵' : 'Rants'), fmt(s.cursed) + (zh ? ' 次' : ''), 'hot');
    stat(t.queueLabel || (zh ? '排隊' : 'In line'), fmt(s.queue) + (zh ? ' 人' : ''), 'gold');
    stat(t.comboLabel || (zh ? '最高連擊' : 'Best combo'), '×' + fmt(s.maxCombo));
    // stage 2: the stars and the rating take the score's place
    if (!Array.isArray(t.stars)) stat(t.scoreLabel || (zh ? '分數' : 'Score'), fmt(s.score));
    else card.classList.add('has-stars');
    if (s.polite) stat(zh ? '被迫客氣' : 'Forced polite', fmt(s.polite) + (zh ? ' 次' : ''), 'pink');
    stat(zh ? '接待' : 'Served', fmt(s.served));
    // stage 2: stars (★1 / ★2 / ★3 with their goals), the rating (C/B/A/S, gold 250), record, ★3 riddle, tomorrow
    if (Array.isArray(t.stars)) {
      const head = el('div', 'report-rate', card);
      const r = el('div', 'rate-badge' + (t.gold ? ' gold' : ''), head, t.gold ? '250' : t.rating || 'C');
      r.dataset.rating = t.gold ? '250' : t.rating || 'C';
      if (t.ratingLabel) el('div', 'rate-label', head, t.ratingLabel);
      if (t.record) el('div', 'report-record', head, t.record);
      const list = el('ul', 'report-stars', card);
      t.stars.forEach((on, i) => {
        const li = el('li', on ? 'on' : '', list);
        li.style.animationDelay = i * 150 + 'ms';
        el('span', 'rs-text', li, (t.starLines || [])[i] || '');
      });
      if (t.hint) el('p', 'report-hint', card, t.hint);
      if (t.bestText) el('p', 'report-best', card, t.bestText);
    } else if (t.star1 != null) {
      // ★1 verdict (days 2+): reached → the button opens the next day; missed → this day again
      const got = (s.queue ?? 0) >= t.star1;
      el('p', 'report-star' + (got ? ' on' : ''), card, zh ? `★1 目標 ${fmt(t.star1)} 人：${got ? '達成！' : '沒達到，再來一次'}` : `★1 goal ${fmt(t.star1)}: ${got ? 'reached!' : 'missed — try again'}`);
    }
    const best = el('div', 'best', card);
    el('div', 'best-label', best, t.bestLabel || (zh ? '最狠一句' : 'Savagest line'));
    const bl = el('div', 'best-line', best);
    fillLine(bl, t.bestLine || '……');
    loudestRow(card, t.loudest);
    if (t.verdict) el('p', 'card-sub', card, t.verdict);
    if (t.tomorrow) el('p', 'report-tomorrow', card, t.tomorrow);
    startButton(card, t.again || texts.again);
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
    const row = el('div', 'loudest', parent);
    el('span', 'loudest-text', row, l.text);
    if (typeof l.onReplay === 'function') {
      const b = el('button', 'loudest-btn', row, l.replay || vt.replayBtn);
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
      const card = el('div', 'card vp-card', promptEl);
      html(el('div', 'vp-icon', card), art.KEY_ICONS.gun);
      el('h2', 'card-title vp-title', card, t.title || '');
      el('p', 'vp-body', card, t.body || '');
      const yes = el('button', 'start-btn vp-yes', card, t.yes || 'OK');
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
  // The line to say sits in the subtitle slot as a plain line (art-direction-v2 10): setup small and dim, punch big;
  // the player's voice lights it up letter by letter (setup to full cream, punch to the key colour). No box, no
  // labels. While it shows, the stage carries data-kara="1" (the subtitle under it steps back).
  let kara = null; // { setupEl, punchEl }
  function karaoke(spec) {
    karaokeEl.textContent = '';
    kara = null;
    if (!spec || (!spec.setup && !spec.punch)) { karaokeEl.hidden = true; stage.dataset.kara = '0'; return; }
    karaokeEl.hidden = false;
    stage.dataset.kara = '1';
    karaokeEl.style.setProperty('--kc', PUNCH_COLOR[spec.key] || PUNCH_COLOR.gun);
    karaokeEl.style.setProperty('--vol', '0');
    const part = (cls, text) => {
      const w = el('div', 'kk ' + cls, karaokeEl);
      const t = el('span', 'kk-text', w, text);
      t.style.setProperty('--fill', '0%');
      return t;
    };
    kara = {
      setupEl: spec.setup ? part('kk-setup', spec.setup) : null,
      punchEl: part('kk-punch', spec.punch || ''),
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
  // Loudness meter (10): a thin capsule at the right edge of the counter front with a megaphone above it; three
  // notches (talk / yell / roar) without words; at the roar it shakes and the megaphone sends two rings. The shop
  // megaphone on the wall (voice mode only) sends rings while the player's shout is replayed.
  function voiceMeter(on) {
    vMeter.hidden = !on;
    voiceMega.hidden = !on;
    if (on && !voiceMega.firstChild) html(voiceMega, megaphoneMarkup());
    if (!on) { stage.dataset.kara = '0'; vMeter.dataset.state = ''; voiceMega.dataset.state = ''; }
  }
  function voiceLevel(v, level = -1, { marks, punch } = {}) {
    const f = Math.max(0, Math.min(1, v));
    vFill.style.height = `${Math.round(f * 100)}%`;
    vMeter.dataset.level = String(level);
    if (Array.isArray(marks)) marks.forEach((y, i) => { vMarks[i].style.bottom = `${Math.round(y * 100)}%`; });
    // the punch line grows with the voice (scale 1 → 1.15)
    if (kara) karaokeEl.style.setProperty('--vol', f.toFixed(2));
    if (punch) voicePunch();
  }
  // the punch of a soft-then-loud line (the voiced 反差): the needle shoots to the top and bounces; no words
  function voicePunch() {
    vFill.style.height = '100%';
    restart(vMeter, 'punch');
    later(() => vMeter.classList.remove('punch'), 420);
  }
  // state, not text (9): 'calib' (a mic and three pulsing dots) | 'replay' (the wall megaphone sends rings) | ''
  function voiceStatus(state) {
    const st = state === 'calib' || state === 'replay' ? state : '';
    vMeter.dataset.state = st;
    voiceMega.dataset.state = st;
  }
  // No floating voice captions any more ("反差 +24dB", "開罵！": 9); the subtitle carries the rare message. Kept as a
  // no-op for older callers.
  function voiceToast() { return null; }

  // ---------- Gameplay v2 stage 2 ----------
  function setPreview(list = []) {
    previewEl.textContent = '';
    previewEl.classList.toggle('show', list.length > 0);
    if (!list.length) return;
    el('span', 'preview-label', previewEl, lang === 'zh' ? '後面' : 'Next');
    list.slice(0, 3).forEach((p, i) => {
      const m = miniSign(previewEl, p.kind || 'gun', p.text || '');
      m.classList.add('preview-sign');
      m.style.setProperty('--i', String(i));
    });
  }

  const METER_TEXT = { zh: ['已收', '杯'], en: ['Booked', 'cups'] };
  function setMeter(value, { hit, over } = {}) {
    if (value == null) { meterEl.hidden = true; return; }
    meterEl.hidden = false;
    const [lbl, unit] = texts.meter || METER_TEXT[lang] || METER_TEXT.zh;
    const v = Math.max(0, Math.floor(value));
    meterEl.innerHTML = `<span class="meter-label">${lbl}</span><b class="meter-num">${v}</b><span class="meter-of">/250${lang === 'zh' ? unit : ' ' + unit}</span>` +
      `<i class="meter-bar"><i style="width:${Math.min(100, (v / 250) * 100).toFixed(1)}%"></i></i>`;
    meterEl.dataset.near = v >= 200 ? '1' : '0';
    if (hit || over) restart(meterEl, hit ? 'hit' : 'over');
  }

  // No "快嘴 ×N" badge (9): kept as a no-op; setCombo(n, quick) shows the run on the counter instead.
  function setQuick() { /* no-op (9) */ }
  // The combo is a cup stack on the counter top (6.2): none for 1–4, 3 cups from 5, 5 from 10, 7 from 20 (A's
  // cupStackSVG, a placeholder until it lands). During fast mouth the stack steams and faint speed lines run along
  // the screen edges (.stage.quick).
  let comboShown = '';
  function setCombo(n = 0, quick = false) {
    const cups = n >= 20 ? 7 : n >= 10 ? 5 : n >= 5 ? 3 : 0;
    stage.classList.toggle('quick', !!quick);
    const sig = cups + ':' + (quick ? 1 : 0);
    if (sig === comboShown) return;
    const grew = cups > (Number(comboShown.split(':')[0]) || 0);
    comboShown = sig;
    cupStack.hidden = cups === 0;
    cupStack.classList.toggle('steam', !!quick && cups > 0);
    if (!cups) { cupStack.textContent = ''; return; }
    // A's cupStackSVG carries its own g.cs-steam wisps; the placeholder gets two CSS ones
    cupStack.innerHTML = cupStackMarkup(cups) + (typeof art.cupStackSVG === 'function' ? '' : '<i class="cs-steam"></i><i class="cs-steam"></i>');
    cupStack.dataset.cups = String(cups);
    if (grew) restart(cupStack, 'grow');
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

  function showEvent({ type = '', title = '', hint = '', big = '' } = {}) {
    eventEl.hidden = false;
    stage.classList.add('eventing'); // the preview steps aside while an event owns the counter
    eventEl.dataset.type = type;
    eventEl.textContent = '';
    el('div', 'ev-title', eventEl, title);
    el('div', 'ev-big', eventEl, big);
    el('div', 'ev-hint', eventEl, hint);
    restart(eventEl, 'in');
  }
  function updateEvent({ big } = {}) {
    if (eventEl.hidden) return;
    const b = eventEl.querySelector('.ev-big');
    if (b && big != null && b.textContent !== String(big)) {
      b.textContent = String(big);
      restart(b, 'pop');
    }
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

  let bannerTimer = 0;
  function dayBanner(title, rule, ms = 2200) {
    clearTimeout(bannerTimer);
    bannerEl.textContent = '';
    if (!title && !rule) { bannerEl.hidden = true; return; }
    el('div', 'db-title', bannerEl, title || '');
    if (rule) el('div', 'db-rule', bannerEl, rule);
    bannerEl.hidden = false;
    restart(bannerEl, 'in');
    bannerTimer = setTimeout(() => { bannerEl.hidden = true; }, ms);
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
    camera, flash, shake, freeze, letterbox, gate, goldsign, speedLines, punchFx, setLite, get lite() { return lite; },
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
    setPreview, setMeter, setQuick, setCombo, showGroup, groupHit, showEvent, updateEvent, hideEvent, shutter, dayBanner,
    // gesture mode (docs/gameplay-v2.md 9)
    setInputMode, get inputMode() { return inputMode; }, setGestureHints, slap, stampHold, stampSlam, setFling, bowl,
    rageHeadAdd, rageHeadHit, clearRageHeads, gestureHint,
    // voice mode (docs/gameplay-v2.md 10)
    setVoiceOptions, voicePrompt, karaoke, karaokeProgress, voiceMeter, voiceLevel, voicePunch, voiceStatus, voiceToast,
    get selMode() { return selMode; },
  };
}
