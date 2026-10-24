// art-bar.js — the 10.9 bar stations and the table dressing of the landscape shop (docs/gameplay-v3-shop.md 10.9,
// docs/art-direction-v2.md 13), in the same tilted three-quarter view and depth kit as art-shop.js (art-kit.js shading,
// soft radial contact shadows, thin outlines in each prop's own darker colour, one warm key light from the upper left).
// Pictures only: no words on any of these (the play screen carries no text). Pure SVG strings, seeded, no DOM.
//
//   milkPumpSVG({ fast })            <svg class="as-station as-milk">, viewBox 0 0 100 160 (鮮奶 dispenser; fast = milk2)
//   foamSVG({ fast })                <svg class="as-station as-foam">, viewBox 0 0 100 135 (奶蓋機; fast = foam2)
//   shakerSVG(state, { fast, auto }) <svg class="as-station as-shaker" data-state="idle|busy">, viewBox 0 0 100 120 (搖杯機);
//                                    the cup stands in the clamp at (50, 104); g.as-shaker-arm wobbles when busy
//   boardSVG({ slicing })            <svg class="as-station as-board" data-slicing>, viewBox 0 0 100 80: the lemon cutting board
//   waffleSVG({ cookingPct, ready, fast })  <svg class="as-station as-waffle" data-cooking data-ready>, viewBox 0 0 100 90:
//                                    the 雞蛋糕 iron (open with golden balls when ready, closed + steam + ring timer cooking)
//   snackBagSVG()                    <svg class="as-snackbag">, viewBox 0 0 60 66: one bag of 雞蛋糕 (dragged to a customer)
//   snackSpotSVG(ready)              <svg class="as-station as-snackspot" data-ready>, viewBox 0 0 64 70: the warmer tray
//   carryBagSVG(n)                   <svg class="as-station as-carrybag" data-n>, viewBox 0 0 100 105: the 提袋 spot, n cups in it
//   fridgeSVG()                      <svg class="as-fridge">, viewBox 0 0 62 300: a glass-door drinks fridge on the left wall
//   lightBoxSVG()                    <svg class="as-lightbox">, viewBox 0 0 94 104: a backlit menu stand with drink pictures
//   fanSVG()                         <svg class="as-fan">, viewBox 0 0 58 72: a desk fan (g.as-fan-blades spins in CSS)
//   registerSVG(), cashTraySVG(), tipJarSVG()   the cash register (132×106), a coin tray (70×52), a tip jar (62×80)
//   towerStandSVG()                  <svg class="as-towerstand">, viewBox 0 0 130 40: the round wooden stand under the cup tower
import { PALETTE, ringPath, mulberry32, fnv1a } from '../art.js';
import { G, ell, ao, cast, over, line, lit, dark, r1 } from './art-kit.js';

const { INK, PAPER, PAPER_SH, GUN, GUN_DEEP, TAKE, TAKE_DEEP, LEMON, GOLD_HI, MINT, SHUT, STEEL, STEEL_LO, NIGHT_700, NIGHT_900, COUNTER, COUNTER_LO, RIM } = PALETTE;
const ring = ringPath;
const svg = (cls, vb, body, attrs = '') => `<svg class="${cls}" viewBox="${vb}" overflow="visible" aria-hidden="true"${attrs}>${body}</svg>`;
const P = (fill, d, extra = '') => `<path fill="${fill}"${extra} d="${d}"/>`;
const S = (stroke, w, d, extra = '') => `<path fill="none" stroke="${stroke}" stroke-width="${w}"${extra} d="${d}"/>`;
const SL = line(STEEL, 0.5);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const MILK_BLUE = '#3D7FC4';
const CREAM = '#FBF3E2';
const WAFFLE = '#E9A43B';
const IRON = '#3A3440';
const BOARD = '#D9A86A';
const KRAFT = '#C99A62';
const FONT_NUM = `font-family="'Baloo 2', 'Noto Sans TC', sans-serif" font-weight="800"`;

function bolt(x, y) { return P(LEMON, `M${x} ${y} l-6 12 h6 l-3 11 l11 -16 h-6 l4 -7 Z`, ` stroke="${TAKE_DEEP}" stroke-width="1" stroke-linejoin="round"`); }

export function milkPumpSVG({ fast = false } = {}) {
  // a white dispenser jug with a blue cap and pump head, a milk-drop picture, the nozzle at the front
  const bodyD = 'M20 50 Q20 40 30 40 H70 Q80 40 80 50 V128 A30 9 0 0 1 20 128 Z';
  const p = [
    cast(50, 150, 40, 8), ao(50, 150, 40, 8),
    P(dark(STEEL, 0.15), ell(50, 140, 30, 8)),
    P(CREAM, bodyD, ` stroke="${line(CREAM, 0.35)}" stroke-width="1.2" stroke-linejoin="round"`), over(bodyD, G.cyl),
    // cow-spot pattern and a milk drop picture
    P('#2E2A36', 'M26 66 q6 -4 9 2 q-2 6 -8 4 Z M66 92 q7 -2 8 5 q-4 5 -9 1 Z M30 108 q5 -3 7 2 q-3 4 -7 1 Z', ' fill-opacity=".85"'),
    P(MILK_BLUE, 'M50 66 q-11 15 0 21 q11 -6 0 -21 Z', ` stroke="${dark(MILK_BLUE, 0.4)}" stroke-width="1.2"`), P('#FFFFFF', 'M46 76 q-2 4 1 6', ' fill-opacity=".8"'),
    // shoulder + cap seen from above
    P(lit(CREAM, 0.4), ell(50, 44, 30, 9)), over(ell(50, 44, 30, 9), G.top),
    P(MILK_BLUE, 'M34 44 V32 A16 5 0 0 1 66 32 V44 A16 5 0 0 1 34 44 Z', ` stroke="${dark(MILK_BLUE, 0.4)}" stroke-width="1.1"`), over('M34 44 V32 A16 5 0 0 1 66 32 V44 A16 5 0 0 1 34 44 Z', G.cyl),
    P(lit(MILK_BLUE, 0.35), ell(50, 32, 16, 5)),
    // pump head + nozzle over the front
    P('url(#gkChrome)', 'M47 32 V16 h6 V32 Z', ` stroke="${SL}" stroke-width="1"`),
    P(MILK_BLUE, 'M34 16 Q34 8 50 8 Q66 8 66 16 Q66 21 50 21 Q34 21 34 16 Z', ` stroke="${dark(MILK_BLUE, 0.4)}" stroke-width="1.1"`), P(lit(MILK_BLUE, 0.4), ell(50, 13.6, 13, 4)),
    P(G.steel, 'M44 118 H56 V132 H53 V140 H47 V132 H44 Z', ` stroke="${SL}" stroke-width="1"`), P('#FFFFFF', 'M48 140 h4 l-.6 3.4 a1.4 1.4 0 0 1 -2.8 0 Z', ` stroke="${line(CREAM, 0.4)}" stroke-width=".6"`),
    S('#FFFFFF', 2.4, 'M27 56 V118', ' stroke-linecap="round" stroke-opacity=".8"'),
    fast ? bolt(72, 54) : '',
  ];
  return svg('as-station as-milk', '0 0 100 160', p.join(''), ` data-fast="${fast ? 1 : 0}"`);
}

export function foamSVG({ fast = false } = {}) {
  // a cream machine with a clear canister of white foam on top and a cheese-wedge picture on its front
  const front = 'M10 58 H90 V112 Q90 118 84 118 H16 Q10 118 10 112 Z';
  const topD = 'M16 46 H84 L90 58 H10 Z';
  const can = 'M28 44 V16 A22 7 0 0 1 72 16 V44 A22 7 0 0 1 28 44 Z';
  const p = [
    cast(50, 126, 46, 8), ao(50, 126, 46, 8),
    P('#F0E2C6', front, ` stroke="${line('#F0E2C6', 0.4)}" stroke-width="1.2"`), over(front, G.front),
    P(lit('#F0E2C6', 0.35), topD, ` stroke="${line('#F0E2C6', 0.4)}" stroke-width="1.1" stroke-linejoin="round"`), over(topD, G.top),
    // the foam canister
    P('#FFFDF6', can, ` stroke="${line(CREAM, 0.4)}" stroke-width="1"`),
    P('url(#gkFoam)', 'M30 44 V22 Q40 18 50 22 T70 22 V44 A20 6 0 0 1 30 44 Z'),
    over(can, G.glass), P(G.steelTop, ell(50, 16, 22, 7), ` stroke="${SL}" stroke-width="1"`), P(STEEL_LO, ell(50, 12, 6, 2.4)),
    // the cheese wedge picture + the nozzle
    P('#F7C948', 'M28 76 L56 68 V92 L28 92 Z', ` stroke="${TAKE_DEEP}" stroke-width="1.2" stroke-linejoin="round"`),
    P('#F2B33A', 'M28 76 L56 68 L60 70 L32 78 Z'), P('#D99A1E', `${ring(38, 84, 2.6)} ${ring(48, 80, 2)} ${ring(46, 88, 1.6)}`),
    P(G.steel, 'M64 92 H80 V104 H74 V112 H70 V104 H64 Z', ` stroke="${SL}" stroke-width="1"`),
    P(MINT, ring(78, 68, 3.4), ` stroke="${dark(MINT, 0.4)}" stroke-width="1"`),
    fast ? bolt(70, 72) : '',
  ];
  return svg('as-station as-foam', '0 0 100 135', p.join(''), ` data-fast="${fast ? 1 : 0}"`);
}

export function shakerSVG(state = 'idle', { fast = false, auto = false } = {}) {
  const busy = state === 'busy';
  const front = 'M6 92 H94 V110 Q94 114 90 114 H10 Q6 114 6 110 Z';
  const topD = 'M12 82 H88 L94 92 H6 Z';
  const p = [
    cast(50, 116, 50, 7), ao(50, 116, 50, 7),
    // the motor base: front face + top face, the round platform the cup stands on
    P(SHUT, front, ` stroke="${dark(SHUT, 0.45)}" stroke-width="1.2"`), over(front, G.front),
    P(lit(SHUT, 0.25), topD, ` stroke="${dark(SHUT, 0.45)}" stroke-width="1.1" stroke-linejoin="round"`), over(topD, G.top),
    P(G.steelTop, ell(50, 100, 24, 6), ` stroke="${SL}" stroke-width="1"`),
    P(busy ? MINT : '#5A4A8A', ring(84, 103, 3), ` stroke="${INK}" stroke-width=".8"`),
    P(GOLD_HI, ring(16, 103, 2.2)),
    // posts and the clamp arm (wobbles while shaking)
    `<g class="as-shaker-arm">${P(G.steel, 'M14 20 h7 v72 h-7 Z M79 20 h7 v72 h-7 Z', ` stroke="${SL}" stroke-width="1"`)}` +
      P(G.steel, 'M10 12 H90 V24 H10 Z', ` stroke="${SL}" stroke-width="1.1"`) + P('url(#gkSteelTop)', 'M14 6 H86 L90 12 H10 Z') +
      P(GUN, 'M40 24 h20 v8 h-20 Z', ` stroke="${GUN_DEEP}" stroke-width="1"`) + '</g>',
    busy ? S(PAPER, 2.4, 'M2 50 q-4 8 0 16 M98 50 q4 8 0 16 M-4 44 q-6 14 0 28 M104 44 q6 14 0 28', ' stroke-linecap="round" stroke-opacity=".9"') : '',
    fast ? bolt(64, 94) : '',
    auto ? P(LEMON, 'M28 96 h44 v3 h-44 Z', ' fill-opacity=".9"') : '',
  ];
  return svg('as-station as-shaker', '0 0 100 120', p.join(''), ` data-state="${busy ? 'busy' : 'idle'}" data-fast="${fast ? 1 : 0}" data-auto="${auto ? 1 : 0}"`);
}

export function boardSVG({ slicing = false } = {}) {
  // a wooden cutting board in perspective, a lemon (whole + half), a knife; slicing: the knife down, fresh wheels
  const top = 'M14 22 H86 L96 62 H4 Z';
  const p = [
    ao(50, 70, 52, 9),
    P(dark(BOARD, 0.25), 'M4 62 H96 L95 70 H5 Z'),
    P(BOARD, top, ` stroke="${line(BOARD, 0.45)}" stroke-width="1.2" stroke-linejoin="round"`), over(top, G.top),
    S(dark(BOARD, 0.15), 1, 'M20 32 H80 M16 44 H84 M10 54 H90', ' stroke-opacity=".45"'),
    // the lemon: a whole one and a half (cut face up)
    P('#E9C21C', ell(30, 38, 13, 9), ` stroke="${line('#E9C21C', 0.4)}" stroke-width="1"`), over(ell(30, 38, 13, 9), G.sph),
    P('#E2A800', ell(56, 46, 12, 6)), P('#FFF6C8', ell(56, 45, 10.6, 5.2)), P(LEMON, ell(56, 45, 8.6, 4.2)),
    S('#FFF6C8', 1, 'M47.4 45 H64.6 M56 40.8 V49.2 M50 42 L62 48 M62 42 L50 48'),
  ];
  if (slicing) {
    p.push(P('#E2A800', ell(74, 52, 9, 4.6)) + P(LEMON, ell(74, 51.4, 7, 3.4)) + P('#E2A800', ell(80, 44, 8, 4)) + P(LEMON, ell(80, 43.4, 6.2, 3)));
    p.push(`<g class="as-knife">${P(G.chrome, 'M44 30 L86 18 L88 24 L48 36 Z', ` stroke="${SL}" stroke-width="1"`)}${P(IRON, 'M86 18 L98 14 L100 20 L88 24 Z')}</g>`);
  } else {
    p.push(`<g class="as-knife">${P(G.chrome, 'M58 18 L92 4 L94 10 L62 24 Z', ` stroke="${SL}" stroke-width="1"`)}${P(IRON, 'M92 4 L100 1 L102 7 L94 10 Z')}</g>`);
  }
  return svg('as-station as-board', '0 0 100 80', p.join(''), ` data-slicing="${slicing ? 1 : 0}"`);
}

export function waffleSVG({ cookingPct = 1, ready = 0, fast = false } = {}) {
  const pct = clamp(Number(cookingPct) || 0, 0, 1);
  const cooking = pct < 1;
  const plate = 'M10 46 H90 L96 74 H4 Z';
  const p = [ao(50, 84, 52, 8)];
  p.push(P(dark(IRON, 0.2), 'M4 74 H96 L95 82 H5 Z'));
  if (cooking) {
    // the lid shut over the mould, steam, the ring timer
    p.push(P(IRON, plate, ` stroke="${line(IRON, 0.3)}" stroke-width="1.2"`));
    p.push(P(lit(IRON, 0.15), 'M12 30 Q50 14 88 30 L94 64 Q50 54 6 64 Z', ` stroke="${line(IRON, 0.3)}" stroke-width="1.2"`), over('M12 30 Q50 14 88 30 L94 64 Q50 54 6 64 Z', G.box));
    p.push(S(dark(IRON, 0.3), 1.2, 'M24 34 Q50 26 76 34 M18 46 Q50 38 82 46', ' stroke-opacity=".7"'));
    p.push(`<path class="as-waffle-steam" fill="none" stroke="${PAPER}" stroke-width="2.6" stroke-linecap="round" stroke-opacity=".75" d="M30 20 q-4 -6 0 -12 M50 16 q-4 -6 0 -12 M70 20 q-4 -6 0 -12"/>`);
    p.push(`<circle cx="90" cy="14" r="10" fill="${NIGHT_700}" stroke="${INK}" stroke-width="1.2"/>`);
    p.push(`<circle class="as-waffle-timer" cx="90" cy="14" r="7" fill="none" stroke="${TAKE}" stroke-width="3.2" pathLength="100" stroke-dasharray="${r1(pct * 100)} 100" transform="rotate(-90 90 14)"/>`);
  } else {
    // open: the lid raised at the back, the mould with golden balls (or empty cups)
    p.push(P(IRON, 'M14 8 H86 L90 44 H10 Z', ` stroke="${line(IRON, 0.3)}" stroke-width="1.2"`), over('M14 8 H86 L90 44 H10 Z', G.front));
    p.push(P(IRON, plate, ` stroke="${line(IRON, 0.3)}" stroke-width="1.2"`), over(plate, G.top, 0.5));
    let cups = '';
    let balls = '';
    let hi = '';
    const full = ready > 0;
    for (let r = 0; r < 3; r++) {
      const y = 52 + r * 7.4;
      const k = 0.8 + 0.2 * r;
      for (let c = 0; c < 6; c++) {
        const x = 50 + (c - 2.5) * (12 + r * 1.4);
        cups += ell(r1(x), r1(y), r1(4.6 * k), r1(2.6 * k)) + ' ';
        balls += ell(r1(x), r1(y - 1.6 * k), r1(4.8 * k), r1(4.2 * k)) + ' ';
        hi += ring(r1(x - 1.6 * k), r1(y - 3.2 * k), r1(1.4 * k)) + ' ';
      }
    }
    p.push(P('#18141C', cups));
    if (full) p.push(P(WAFFLE, balls, ` stroke="${dark(WAFFLE, 0.45)}" stroke-width=".7"`) + P('#FFE29A', hi, ' fill-opacity=".9"'));
  }
  // the handles at the front
  p.push(P(GUN, 'M40 80 h20 v5 h-20 Z', ` stroke="${GUN_DEEP}" stroke-width="1"`));
  if (fast) p.push(bolt(14, 60));
  return svg('as-station as-waffle', '0 0 100 90', p.join(''), ` data-cooking="${cooking ? 1 : 0}" data-ready="${ready | 0}"`);
}

/** One bag of 雞蛋糕: a red-striped paper bag with golden balls peeking out (dragged to a customer). */
export function snackBagSVG() {
  const bag = 'M10 24 H50 L47 62 H13 Z';
  return svg('as-snackbag', '0 0 60 66', ao(30, 63, 22, 4) +
    P('#F7E9C8', bag, ` stroke="${line('#F7E9C8', 0.45)}" stroke-width="1.2" stroke-linejoin="round"`) + over(bag, G.cyl) +
    P(GUN, 'M10.8 32 H49.2 L48.9 37 H11.1 Z M11.5 44 H48.5 L48.2 49 H11.8 Z') +
    P(WAFFLE, `${ring(20, 22, 7.4)} ${ring(36, 20, 7.8)} ${ring(28, 12, 7.2)}`, ` stroke="${dark(WAFFLE, 0.45)}" stroke-width="1"`) +
    over(`${ring(20, 22, 7.4)}`, G.sph) + over(`${ring(36, 20, 7.8)}`, G.sph) + over(`${ring(28, 12, 7.2)}`, G.sph) +
    P(PAPER_SH, 'M10 24 H50 L49 28 H11 Z'));
}

/** The warmer tray next to the iron: up to 3 ready bags stand in it. */
export function snackSpotSVG(ready = 0) {
  const n = clamp(ready | 0, 0, 3);
  const top = 'M6 46 H58 L62 62 H2 Z';
  let bags = '';
  const pos = [[20, 48], [44, 48], [32, 58]].slice(0, n);
  for (const [x, y] of pos) {
    bags += P('#F7E9C8', `M${x - 9} ${y - 22} H${x + 9} L${x + 8} ${y} H${x - 8} Z`, ` stroke="${line('#F7E9C8', 0.45)}" stroke-width="1"`) +
      P(GUN, `M${x - 8.6} ${y - 15} H${x + 8.6} V${y - 12} H${x - 8.6} Z`) +
      P(WAFFLE, `${ring(x - 4, y - 23, 4)} ${ring(x + 4, y - 24, 4.2)}`, ` stroke="${dark(WAFFLE, 0.45)}" stroke-width=".7"`);
  }
  return svg('as-station as-snackspot', '0 0 64 70', ao(32, 66, 32, 5) + P(dark(STEEL, 0.2), 'M2 62 H62 L61 68 H3 Z') +
    P('url(#gkSteelTop)', top, ` stroke="${SL}" stroke-width="1.1" stroke-linejoin="round"`) + P(GUN, 'M4 60 H60 L61 62 H3 Z', ' fill-opacity=".6"') + bags,
  ` data-ready="${n}"`);
}

/** The 提袋 spot: a kraft carry bag standing open; packed cups show their sealed lids in it. */
export function carryBagSVG(n = 0) {
  const k = clamp(n | 0, 0, 4);
  const front = 'M14 40 H86 L82 98 H18 Z';
  const p = [
    cast(50, 100, 46, 7), ao(50, 100, 46, 7),
    P(dark(KRAFT, 0.3), 'M22 30 H78 L86 40 H14 Z'),                           // the inside back
    S(dark(KRAFT, 0.4), 3, 'M34 32 Q50 2 66 32', ' stroke-linecap="round"'),   // the back handle
  ];
  const lids = [[34, 38], [66, 38], [42, 30], [60, 30]].slice(0, k);
  for (const [x, y] of lids) {
    p.push(P('#DDEFF7', `M${x - 12} ${y} L${x - 9} ${y + 14} H${x + 9} L${x + 12} ${y} Z`, ' stroke="#7FA6BC" stroke-width="1"'));
    p.push(P(PAPER, ell(x, y, 12, 4.4), ` stroke="${line(PAPER, 0.45)}" stroke-width="1"`) + P('none', ell(x, y, 7, 2.6), ` stroke="${GUN}" stroke-width="1.1"`));
  }
  p.push(P(KRAFT, front, ` stroke="${line(KRAFT, 0.45)}" stroke-width="1.2" stroke-linejoin="round"`), over(front, G.cyl));
  p.push(S(dark(KRAFT, 0.2), 1, 'M14 40 L18 98 M86 40 L82 98', ' stroke-opacity=".6"'));
  p.push(P(GUN, 'M38 60 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 Z', ' fill-opacity=".9"') + P(PAPER, 'M44 54 H56 L54 70 H46 Z'));
  p.push(S(dark(KRAFT, 0.45), 3.4, 'M32 42 Q50 10 68 42', ' stroke-linecap="round"') + S(lit(KRAFT, 0.3), 1.2, 'M33 40 Q50 12 67 40', ' stroke-linecap="round"'));
  if (k) p.push(P(MINT, ring(86, 30, 9), ` stroke="${INK}" stroke-width="1.6"`) + `<text x="86" y="34.4" ${FONT_NUM} font-size="12" text-anchor="middle" fill="${PAPER}">${k}</text>`);
  return svg('as-station as-carrybag', '0 0 100 105', p.join(''), ` data-n="${k}"`);
}

// ─── Table dressing (decoration only, no words) ────────────────────────────────────────────────
export function fridgeSVG() {
  // a glass-door drinks fridge on the left wall, seen at an angle: its glowing inside, shelves of bottles, a chrome handle
  const rnd = mulberry32(fnv1a('fridge'));
  const colors = [GUN, TAKE, MINT, '#7FD4FF', SHUT, '#FF8FC1', '#F2A65A'];
  let bottles = '';
  for (let s = 0; s < 4; s++) {
    const y = 74 + s * 52;
    for (let i = 0; i < 3; i++) {
      const x = 16 + i * 11 + s * 0.6;
      const c = colors[Math.floor(rnd() * colors.length)];
      bottles += P(c, `M${r1(x)} ${y} V${y - 22} Q${r1(x)} ${y - 28} ${r1(x + 3)} ${y - 30} V${y - 36} h3 V${y - 30} Q${r1(x + 9)} ${y - 28} ${r1(x + 9)} ${y - 22} V${y} Z`, ` stroke="${line(c, 0.45)}" stroke-width=".8"`);
      bottles += P('#FFFFFF', `M${r1(x + 1.6)} ${y - 20} h1.6 v16 h-1.6 Z`, ' fill-opacity=".55"');
    }
  }
  const body = 'M0 0 L62 14 V298 L0 300 Z';
  const glass = 'M8 22 L54 32 V262 L8 270 Z';
  return svg('as-fridge', '0 0 62 300', P('#E9EEF3', body, ` stroke="${SL}" stroke-width="1.2"`) + over(body, G.cylSoft) +
    P('#CFE9F7', glass) + `<path fill="url(#gkGlow)" d="${glass}"/>` +
    S('#FFFFFF', 1.6, 'M10 74 L52 78 M10 126 L52 130 M10 178 L52 182 M10 230 L52 234', ' stroke-opacity=".8"') + bottles +
    over(glass, G.glass) + S('#9FC4D8', 1.2, glass) +
    P('url(#gkChrome)', 'M48 120 h4 v60 h-4 Z', ` stroke="${SL}" stroke-width=".8"`) +
    P(GUN, 'M4 4 L58 16 V24 L4 14 Z') + P(GOLD_HI, 'M14 8 l3 1 -1 3 Z M30 11 l3 1 -1 3 Z', ' fill-opacity=".8"'));
}

export function lightBoxSVG() {
  // a backlit menu stand: three glowing drink pictures and a golden 250 cup, no words
  const cups = [[22, '#C99566'], [47, '#CBD97E'], [72, '#9BD957']].map(([x, c]) =>
    P(c, `M${x - 9} 22 H${x + 9} L${x + 7} 48 H${x - 7} Z`, ` stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"`) + over(`M${x - 9} 22 H${x + 9} L${x + 7} 48 H${x - 7} Z`, G.cyl) +
    P('#2B1A12', `${ring(x - 4, 44, 1.8)} ${ring(x, 45, 1.8)} ${ring(x + 4, 44, 1.8)}`) + S(INK, 1.4, `M${x + 4} 22 L${x + 7} 15`, ' stroke-linecap="round"')).join('');
  const frame = 'M4 6 H90 V82 H4 Z';
  return svg('as-lightbox', '0 0 94 104', cast(47, 100, 44, 5) + ao(47, 100, 44, 5) + P('url(#gkSteelTop)', 'M30 82 H64 L70 98 H24 Z') +
    P(NIGHT_900, frame, ` stroke="${line(NIGHT_900, 0.1)}" stroke-width="1.4"`) +
    P('#FFF4D6', 'M9 11 H85 V77 H9 Z') + `<path fill="url(#gkGlow)" d="M9 11 H85 V77 H9 Z"/>` + cups +
    P(TAKE, 'M39 56 H55 L53 72 H41 Z', ` stroke="${INK}" stroke-width="1.2"`) + P(GOLD_HI, 'M59 56 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6 Z') +
    P(GUN, 'M14 58 h18 v6 h-18 Z M14 68 h12 v4 h-12 Z M64 68 h16 v4 h-16 Z') + over(frame, G.box, 0.5));
}

export function fanSVG() {
  return svg('as-fan', '0 0 58 72', ao(29, 69, 22, 4) + P('url(#gkSteelTop)', ell(29, 64, 16, 5), ` stroke="${SL}" stroke-width="1"`) +
    P(G.steel, 'M27 40 h4 v24 h-4 Z') +
    P('#DCE6EE', ring(29, 26, 22), ` stroke="${SL}" stroke-width="1.4"`) + over(ring(29, 26, 22), G.sph, 0.5) +
    `<g class="as-fan-blades">${P(RIM, 'M29 26 Q20 8 29 6 Q36 12 29 26 Z M29 26 Q47 20 48 30 Q40 36 29 26 Z M29 26 Q20 42 12 36 Q14 26 29 26 Z', ' fill-opacity=".85"')}</g>` +
    P(GUN, ring(29, 26, 4), ` stroke="${GUN_DEEP}" stroke-width="1"`) + S(SL, 0.8, `${ring(29, 26, 15)} M29 4 V48 M7 26 H51`, ' stroke-opacity=".5"'));
}

export function registerSVG() {
  // the cash register on the front worktop, seen from above: key pad, display, drawer
  const front = 'M6 66 H126 V98 H6 Z';
  return svg('as-register', '0 0 132 106', cast(66, 102, 64, 6) + ao(66, 102, 64, 6) +
    P(PAPER, front, ` stroke="${line(PAPER, 0.45)}" stroke-width="1.2"`) + over(front, G.front) + P(PAPER_SH, 'M6 86 H126 V98 H6 Z') +
    S(line(PAPER, 0.5), 1.4, 'M54 80 H78') +
    P(GUN, 'M14 66 L26 30 H106 L118 66 Z', ` stroke="${GUN_DEEP}" stroke-width="1.2" stroke-linejoin="round"`) + over('M14 66 L26 30 H106 L118 66 Z', G.top) +
    P('#FFF4E2', [0, 1, 2, 3].flatMap((c) => [0, 1].map((r) => `M${36 + c * 16 + r * 3} ${40 + r * 11} h12 v7 h-12 Z`)).join(' ')) +
    P(G.steel, 'M78 30 V12 H122 V30 Z', ` stroke="${SL}" stroke-width="1.1"`) + P(NIGHT_900, 'M82 15 H118 V26 H82 Z') +
    `<text x="100" y="24.6" font-family="'DSEG7 Classic', monospace" font-size="8" text-anchor="middle" fill="${MINT}">250</text>`);
}

export function cashTraySVG() {
  const top = 'M6 12 H64 L68 40 H2 Z';
  let coins = '';
  for (const [x, y, r] of [[16, 28, 6], [28, 24, 6.4], [40, 30, 6], [52, 24, 5.6], [22, 34, 5.4], [48, 36, 5.8]]) coins += ell(x, y, r, r * 0.55) + ' ';
  return svg('as-cashtray', '0 0 70 52', ao(35, 46, 34, 6) + P(dark(COUNTER, 0.1), 'M2 40 H68 L67 46 H3 Z') +
    P(COUNTER, top, ` stroke="${line(COUNTER, 0.3)}" stroke-width="1"`) + over(top, G.top, 0.6) +
    P(TAKE, coins, ` stroke="${TAKE_DEEP}" stroke-width=".8"`) + P(GOLD_HI, coins.replace(/a([\d.]+) ([\d.]+)/g, (m, a, b) => `a${r1(a * 0.5)} ${r1(b * 0.5)}`), ' fill-opacity=".7"'));
}

export function tipJarSVG() {
  // a glass jar with coins and folded notes (no words), a red ribbon
  const jar = 'M10 22 Q10 16 16 16 H46 Q52 16 52 22 V70 Q52 76 46 76 H16 Q10 76 10 70 Z';
  return svg('as-tipjar', '0 0 62 80', cast(31, 78, 26, 4) + ao(31, 78, 26, 4) +
    P('#E3F2F9', jar, ' fill-opacity=".45"') +
    P(TAKE, `${ell(22, 68, 7, 3)} ${ell(36, 66, 7, 3)} ${ell(28, 62, 6.4, 2.8)} ${ell(42, 60, 6, 2.6)}`, ` stroke="${TAKE_DEEP}" stroke-width=".8"`) +
    P('#8FC79A', 'M16 54 L30 46 L36 56 L22 62 Z', ' stroke="#4E8A5A" stroke-width=".8"') + P('#F2A6B2', 'M30 50 L46 44 L48 54 L34 58 Z', ' stroke="#B8606E" stroke-width=".8"') +
    over(jar, G.glass) + S('#9FC4D8', 1.2, jar) +
    P(G.steelTop, ell(31, 16, 21, 5), ` stroke="${SL}" stroke-width="1"`) + P('#2A2030', ell(31, 16, 15, 3.2)) +
    P(GUN, 'M10 30 H52 V36 H10 Z', ' fill-opacity=".9"') + P(GUN, 'M28 33 l-6 10 h5 l3 -6 l3 6 h5 l-6 -10 Z'));
}

export function towerStandSVG() {
  return svg('as-towerstand', '0 0 130 40', ao(65, 32, 64, 8) + P('url(#gkWood)', 'M6 16 V26 A59 11 0 0 0 124 26 V16 Z', ` stroke="${line('#C98A4B', 0.45)}" stroke-width="1.2"`) +
    over('M6 16 V26 A59 11 0 0 0 124 26 V16 Z', G.cyl) + P('#E6B373', ell(65, 16, 59, 11), ` stroke="${line('#C98A4B', 0.45)}" stroke-width="1.2"`) + over(ell(65, 16, 59, 11), G.top) +
    P(GUN, 'M6 22 A59 11 0 0 0 124 22 V24 A59 11 0 0 1 6 24 Z', ' fill-opacity=".85"'));
}

void NIGHT_700; void COUNTER_LO; void GOLD_HI;
