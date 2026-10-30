// art-bar.js — the 10.9 bar stations and the table dressing of the landscape shop (docs/gameplay-v3-shop.md 10.9,
// docs/art-direction-v2.md 13, 14), in the same tilted three-quarter view and depth kit as art-shop.js (art-kit.js shading,
// soft radial contact shadows, thin outlines in each prop's own darker colour, one warm key light from the upper left).
// Warm and detailed like the tea tank / pearl pot / sealer: stainless that reflects the warm shop light, chocolate darks
// instead of night blues, small believable details (feet, screws, seams, vents, drip trays, wordless stickers, glints, steam).
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

const { INK, PAPER, PAPER_SH, GUN, GUN_DEEP, TAKE, TAKE_DEEP, LEMON, GOLD_HI, MINT, SHUT } = PALETTE;
// the work area's warm tokens (same as art-shop.js): warm stainless, chocolate darks
const STEEL = '#D6C5B8';
const STEEL_HI = '#FFF8EE';
const STEEL_LO = '#937E75';
const NIGHT = '#3D2722';
const CHOC = '#5E3628';
const CHOC_LO = '#36201A';
const PEACH = '#FFD2A8';
const ring = ringPath;
const svg = (cls, vb, body, attrs = '') => `<svg class="${cls}" viewBox="${vb}" overflow="visible" aria-hidden="true"${attrs}>${body}</svg>`;
const P = (fill, d, extra = '') => `<path fill="${fill}"${extra} d="${d}"/>`;
const S = (stroke, w, d, extra = '') => `<path fill="none" stroke="${stroke}" stroke-width="${w}"${extra} d="${d}"/>`;
const SL = line(STEEL, 0.5);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const MILK_BLUE = '#3D86CC';
const CREAM = '#FFF6E6';
const WAFFLE = '#EDA53A';
const IRON = '#45332E';
const BOARD = '#DDA766';
const KRAFT = '#CF9C60';
const FONT_NUM = `font-family="'Baloo 2', 'Noto Sans TC', sans-serif" font-weight="800"`;
const screws = (pts, r = 1.1) => P(dark(STEEL, 0.32), pts.map(([x, y]) => ring(x, y, r)).join(' '));
const glints = (pts) => P('#FFFFFF', pts.map(([x, y, r]) => `M${x} ${r1(y - r)} L${r1(x + r * 0.28)} ${r1(y - r * 0.28)} L${r1(x + r)} ${y} L${r1(x + r * 0.28)} ${r1(y + r * 0.28)} L${x} ${r1(y + r)} L${r1(x - r * 0.28)} ${r1(y + r * 0.28)} L${r1(x - r)} ${y} L${r1(x - r * 0.28)} ${r1(y - r * 0.28)} Z`).join(' '), ' fill-opacity=".9"');

function bolt(x, y) { return P(LEMON, `M${x} ${y} l-6 12 h6 l-3 11 l11 -16 h-6 l4 -7 Z`, ` stroke="${TAKE_DEEP}" stroke-width="1" stroke-linejoin="round"`); }

export function milkPumpSVG({ fast = false } = {}) {
  // a cream dispenser jug on a steel drip stand: blue cap and pump head, a milk-drop picture, the nozzle at the front
  const bodyD = 'M20 50 Q20 40 30 40 H70 Q80 40 80 50 V128 A30 9 0 0 1 20 128 Z';
  const band = 'M20 100 A30 9 0 0 0 80 100 V108 A30 9 0 0 1 20 108 Z';
  const p = [
    cast(50, 152, 40, 7), ao(50, 152, 40, 8),
    // the stand: a steel disc with a grated drip tray in front
    P(G.steel, 'M16 140 H84 V146 A34 7 0 0 1 16 146 Z', ` stroke="${SL}" stroke-width="1"`), P(G.steelTop, ell(50, 140, 34, 7.4), ` stroke="${SL}" stroke-width="1"`),
    P(dark(STEEL, 0.36), 'M38 142 H62 L64 150 H36 Z', ` stroke="${SL}" stroke-width=".8"`), S(STEEL_HI, 0.8, 'M39 144.4 H61 M38.4 147 H61.6', ' stroke-opacity=".8"'),
    P(CREAM, bodyD, ` stroke="${line(CREAM, 0.38)}" stroke-width="1.2" stroke-linejoin="round"`), over(bodyD, G.cyl),
    // soft cow spots, a blue band round the base, the milk-drop picture on a round label
    P('#4A3430', 'M26 66 q6 -4 9 2 q-2 6 -8 4 Z M68 88 q7 -2 8 5 q-4 5 -9 1 Z M28 116 q5 -3 7 2 q-3 4 -7 1 Z', ' fill-opacity=".8"'),
    P(MILK_BLUE, band, ` stroke="${dark(MILK_BLUE, 0.4)}" stroke-width=".8"`), over(band, G.cyl),
    P('#FFFFFF', ring(50, 76, 13), ` stroke="${MILK_BLUE}" stroke-width="1.6"`),
    P(MILK_BLUE, 'M50 66 q-9 12 0 17 q9 -5 0 -17 Z', ` stroke="${dark(MILK_BLUE, 0.4)}" stroke-width="1"`), P('#FFFFFF', 'M47 74 q-2 4 1 6', ' fill-opacity=".85"'),
    // shoulder + cap seen from above
    P(lit(CREAM, 0.4), ell(50, 44, 30, 9)), over(ell(50, 44, 30, 9), G.top),
    P(MILK_BLUE, 'M34 44 V32 A16 5 0 0 1 66 32 V44 A16 5 0 0 1 34 44 Z', ` stroke="${dark(MILK_BLUE, 0.4)}" stroke-width="1.1"`), over('M34 44 V32 A16 5 0 0 1 66 32 V44 A16 5 0 0 1 34 44 Z', G.cyl),
    S(dark(MILK_BLUE, 0.3), 0.8, 'M37 34 V43 M41 35 V44 M45 35.4 V44.6 M55 35.4 V44.6 M59 35 V44 M63 34 V43', ' stroke-opacity=".6"'),
    P(lit(MILK_BLUE, 0.35), ell(50, 32, 16, 5)),
    // pump head + nozzle over the front
    P(G.chrome, 'M47 32 V16 h6 V32 Z', ` stroke="${SL}" stroke-width="1"`),
    P(MILK_BLUE, 'M34 16 Q34 8 50 8 Q66 8 66 16 Q66 21 50 21 Q34 21 34 16 Z', ` stroke="${dark(MILK_BLUE, 0.4)}" stroke-width="1.1"`), P(lit(MILK_BLUE, 0.4), ell(50, 13.6, 13, 4)),
    S('#FFFFFF', 1.2, 'M39 12 Q44 9.6 50 9.4', ' stroke-linecap="round" stroke-opacity=".8"'),
    P(G.steel, 'M44 118 H56 V132 H53 V138 H47 V132 H44 Z', ` stroke="${SL}" stroke-width="1"`), P('#FFFFFF', 'M48 138 h4 l-.6 3.4 a1.4 1.4 0 0 1 -2.8 0 Z', ` stroke="${line(CREAM, 0.4)}" stroke-width=".6"`),
    // the key light down the jug, a warm rim on the right, cold condensation drops
    S('#FFFFFF', 2.4, 'M27 56 V118', ' stroke-linecap="round" stroke-opacity=".8"'), S(PEACH, 1.2, 'M77.6 52 V126', ' stroke-linecap="round" stroke-opacity=".7"'),
    P('#FFFFFF', [[70, 62], [74, 74], [68, 84], [73, 112]].map(([x, y]) => `M${x} ${y} q1.4 2.2 0 3 q-1.4 -.8 0 -3 Z`).join(' '), ' fill-opacity=".8"'),
    fast ? bolt(72, 54) : '',
  ];
  return svg('as-station as-milk', '0 0 100 160', p.join(''), ` data-fast="${fast ? 1 : 0}"`);
}

export function foamSVG({ fast = false } = {}) {
  // a cream machine with a clear canister of white foam on top, a cheese-wedge picture, a drip tray under the nozzle
  const C = '#F6E4C6';
  const front = 'M10 58 H90 V112 Q90 118 84 118 H16 Q10 118 10 112 Z';
  const topD = 'M16 46 H84 L90 58 H10 Z';
  const can = 'M28 44 V16 A22 7 0 0 1 72 16 V44 A22 7 0 0 1 28 44 Z';
  const p = [
    cast(50, 126, 46, 8), ao(50, 126, 46, 8),
    P(CHOC_LO, 'M14 117 h10 v5 h-10 Z M76 117 h10 v5 h-10 Z'),
    P(C, front, ` stroke="${line(C, 0.4)}" stroke-width="1.2"`), over(front, G.front),
    P(lit(C, 0.35), topD, ` stroke="${line(C, 0.4)}" stroke-width="1.1" stroke-linejoin="round"`), over(topD, G.top),
    // a toffee-coloured trim band, side vents, corner screws
    P('#C9783E', 'M10 60 H90 V64 H10 Z'), S(line(C, 0.3), 1.2, 'M14 100 H24 M14 104 H24 M14 108 H24', ' stroke-linecap="round"'),
    screws([[14, 70], [86, 70], [14, 113], [86, 113]]),
    // the foam canister: a clear jar of whipped foam with a soft peak, a steel lid and knob
    P('#FFFDF6', can, ` stroke="${line(CREAM, 0.4)}" stroke-width="1"`),
    P(G.foam, 'M30 44 V22 Q36 16 42 21 Q48 14 56 20 Q63 16 70 22 V44 A20 6 0 0 1 30 44 Z'),
    S('#EBD39C', 1, 'M34 30 q6 -3 12 0 t12 0 M36 38 q6 -3 12 0 t12 0', ' stroke-opacity=".8" stroke-linecap="round"'),
    over(can, G.glass), P('#FFFFFF', 'M31 20 h2.6 V42 h-2.6 Z', ' fill-opacity=".6"'),
    P(G.steelTop, ell(50, 16, 22, 7), ` stroke="${SL}" stroke-width="1"`), P(CHOC, ell(50, 12, 6, 2.4)), P(lit(CHOC, 0.4), ell(49, 11.4, 3.4, 1.2)),
    // the cheese wedge picture with holes and a shine
    P('#F7C948', 'M24 76 L54 68 V94 L24 94 Z', ` stroke="${TAKE_DEEP}" stroke-width="1.2" stroke-linejoin="round"`),
    P('#FFDF7A', 'M24 76 L54 68 L58 70 L28 78 Z'), P('#DE9C1E', `${ring(34, 86, 2.6)} ${ring(45, 81, 2)} ${ring(44, 89, 1.6)} ${ring(30, 92, 1.2)}`),
    S('#FFFFFF', 1, 'M27 80 V90', ' stroke-opacity=".7" stroke-linecap="round"'),
    // the nozzle over a small grated drip tray, a power light
    P(G.steel, 'M64 88 H80 V100 H74 V106 H70 V100 H64 Z', ` stroke="${SL}" stroke-width="1"`), P('#FFFFFF', 'M70.6 106 h2.8 l-.4 2.4 a1 1 0 0 1 -2 0 Z'),
    P(dark(STEEL, 0.3), 'M62 110 H82 L83 115 H61 Z', ` stroke="${SL}" stroke-width=".7"`), S(STEEL_HI, 0.7, 'M63 112.4 H81', ' stroke-opacity=".8"'),
    P(MINT, ring(78, 76, 3.2), ` stroke="${dark(MINT, 0.4)}" stroke-width="1"`), P('#FFFFFF', ring(77, 75, 1), ' fill-opacity=".85"'),
    S(PEACH, 1.2, 'M88.6 60 V112', ' stroke-opacity=".7" stroke-linecap="round"'),
    fast ? bolt(70, 72) : '',
  ];
  return svg('as-station as-foam', '0 0 100 135', p.join(''), ` data-fast="${fast ? 1 : 0}"`);
}

export function shakerSVG(state = 'idle', { fast = false, auto = false } = {}) {
  const busy = state === 'busy';
  const front = 'M6 92 H94 V110 Q94 114 90 114 H10 Q6 114 6 110 Z';
  const topD = 'M12 82 H88 L94 92 H6 Z';
  const p = [
    cast(50, 117, 50, 7), ao(50, 117, 50, 7),
    P(CHOC_LO, 'M10 113 h10 v5 h-10 Z M80 113 h10 v5 h-10 Z'),
    // the motor base: front face + top face, a vent grille, a speed dial, two status lights, the round rubber platform
    P(SHUT, front, ` stroke="${dark(SHUT, 0.45)}" stroke-width="1.2"`), over(front, G.front), over(front, G.sheen, 0.5),
    P(lit(SHUT, 0.25), topD, ` stroke="${dark(SHUT, 0.45)}" stroke-width="1.1" stroke-linejoin="round"`), over(topD, G.top),
    S(dark(SHUT, 0.35), 1.2, 'M26 100 V108 M30 100 V108 M34 100 V108 M66 100 V108 M70 100 V108 M74 100 V108', ' stroke-linecap="round"'),
    P(G.steelTop, ell(50, 98, 26, 6.4), ` stroke="${SL}" stroke-width="1"`), P(CHOC, ell(50, 98, 20, 4.6)), S(lit(CHOC, 0.3), 1, 'M33 97 Q50 92 67 97', ' stroke-opacity=".7"'),
    P(G.chrome, ring(86, 102, 4), ` stroke="${SL}" stroke-width=".8"`), S(CHOC, 1.2, 'M86 102 L88.6 99.4', ' stroke-linecap="round"'),
    P(busy ? MINT : '#5A4A8A', ring(14, 101, 2.4), ` stroke="${dark(SHUT, 0.5)}" stroke-width=".8"`), P(GOLD_HI, ring(14, 108, 2)),
    screws([[10, 95], [90, 95]], 1),
    // posts and the clamp arm (wobbles while shaking): chrome posts, a red clamp with a rubber pad, a glint
    `<g class="as-shaker-arm">${P(G.steel, 'M14 20 h7 v72 h-7 Z M79 20 h7 v72 h-7 Z', ` stroke="${SL}" stroke-width="1"`)}` +
      S('#FFFFFF', 1.2, 'M15.6 22 V90 M80.6 22 V90', ' stroke-opacity=".7"') +
      P(G.steel, 'M10 12 H90 V24 H10 Z', ` stroke="${SL}" stroke-width="1.1"`) + P(G.steelTop, 'M14 6 H86 L90 12 H10 Z') +
      screws([[14, 18], [86, 18]], 1) +
      P(GUN, 'M38 24 h24 v8 q0 2 -2 2 h-20 q-2 0 -2 -2 Z', ` stroke="${GUN_DEEP}" stroke-width="1"`) + over('M38 24 h24 v8 q0 2 -2 2 h-20 q-2 0 -2 -2 Z', G.front) +
      P(CHOC_LO, 'M42 34 h16 v2 h-16 Z') + '</g>',
    busy ? S(PAPER, 2.4, 'M2 50 q-4 8 0 16 M98 50 q4 8 0 16 M-4 44 q-6 14 0 28 M104 44 q6 14 0 28', ' stroke-linecap="round" stroke-opacity=".9"') : '',
    fast ? bolt(64, 94) : '',
    auto ? P(LEMON, 'M28 92.6 h44 v2.6 h-44 Z', ' fill-opacity=".9"') : '',
  ];
  return svg('as-station as-shaker', '0 0 100 120', p.join(''), ` data-state="${busy ? 'busy' : 'idle'}" data-fast="${fast ? 1 : 0}" data-auto="${auto ? 1 : 0}"`);
}

export function boardSVG({ slicing = false } = {}) {
  // a wooden cutting board in perspective (grain, a hanging hole, juice), a whole lemon with a leaf, a half, a knife;
  // slicing: the knife down, fresh wheels
  const top = 'M14 22 H86 L96 62 H4 Z';
  const p = [
    ao(50, 70, 52, 9),
    P(dark(BOARD, 0.28), 'M4 62 H96 L95 70 H5 Z'), S(lit(BOARD, 0.3), 1, 'M5 62.8 H95', ' stroke-opacity=".7"'),
    P(BOARD, top, ` stroke="${line(BOARD, 0.45)}" stroke-width="1.2" stroke-linejoin="round"`), over(top, G.top),
    S(dark(BOARD, 0.18), 1, 'M20 32 Q40 30 56 32.6 T80 32 M16 44 Q36 42 60 44.6 T84 44 M10 54 Q40 52 66 54.6 T90 54', ' stroke-opacity=".45"'),
    S(lit(BOARD, 0.4), 1, 'M24 27 Q40 25.6 60 27.4 M12 50 Q26 48.6 40 50', ' stroke-opacity=".6" stroke-linecap="round"'),
    P(dark(BOARD, 0.35), ell(84, 28, 3.4, 1.8)),
    // juice drops on the board
    P('#FFE680', `${ell(68, 56, 3, 1.2)} ${ell(42, 58, 2.2, 0.9)} ${ell(76, 48, 1.6, 0.7)}`, ' fill-opacity=".8"'),
    // the lemon: a whole one with a leaf and a half (cut face up, with seeds)
    P('#F2C61C', ell(30, 38, 13, 9), ` stroke="${line('#F2C61C', 0.4)}" stroke-width="1"`), over(ell(30, 38, 13, 9), G.sph),
    P('#6FA83E', 'M38 31 q8 -6 12 -2 q-6 6 -12 2 Z', ' stroke="#4A7A2A" stroke-width=".8"'), P('#9A6A3A', 'M37 31.4 l2 -1.6 l.8 .8 Z'),
    P('#E8A400', ell(56, 46, 12, 6)), P('#FFF8D2', ell(56, 45, 10.6, 5.2)), P('#FFD23A', ell(56, 45, 8.6, 4.2)),
    S('#FFF8D2', 1, 'M47.4 45 H64.6 M56 40.8 V49.2 M50 42 L62 48 M62 42 L50 48'),
    P('#FFFBE8', `${ell(53, 43.6, 0.9, 0.5)} ${ell(59, 46.4, 0.9, 0.5)}`), P('#FFFFFF', ell(52, 43, 2.6, 1), ' fill-opacity=".6"'),
  ];
  const knife = (d1, d2, d3) => P(G.chrome, d1, ` stroke="${SL}" stroke-width="1"`) + S('#FFFFFF', 0.9, d3, ' stroke-opacity=".8" stroke-linecap="round"') + P(CHOC, d2, ` stroke="${CHOC_LO}" stroke-width=".7"`);
  if (slicing) {
    p.push(P('#E8A400', `${ell(74, 52, 9, 4.6)} ${ell(80, 44, 8, 4)}`) + P('#FFD23A', `${ell(74, 51.4, 7, 3.4)} ${ell(80, 43.4, 6.2, 3)}`));
    p.push(`<g class="as-knife">${knife('M44 30 L86 18 L88 24 L48 36 Z', 'M86 18 L98 14 Q101 14 100 17 L100 20 L88 24 Z', 'M47 31.6 L85 20.4')}</g>`);
  } else {
    p.push(`<g class="as-knife">${knife('M58 18 L92 4 L94 10 L62 24 Z', 'M92 4 L100 1 Q103 1 102 4 L102 7 L94 10 Z', 'M61 19.6 L90.6 7')}</g>`);
  }
  return svg('as-station as-board', '0 0 100 80', p.join(''), ` data-slicing="${slicing ? 1 : 0}"`);
}

export function waffleSVG({ cookingPct = 1, ready = 0, fast = false } = {}) {
  const pct = clamp(Number(cookingPct) || 0, 0, 1);
  const cooking = pct < 1;
  const plate = 'M10 46 H90 L96 74 H4 Z';
  const p = [cast(50, 84, 50, 7), ao(50, 84, 52, 8)];
  // a red enamel base under the cast-iron plates, little feet, two screws
  p.push(P(CHOC_LO, 'M8 82 h8 v4 h-8 Z M84 82 h8 v4 h-8 Z'));
  p.push(P(GUN, 'M4 74 H96 L95 84 H5 Z', ` stroke="${GUN_DEEP}" stroke-width="1"`) + over('M4 74 H96 L95 84 H5 Z', G.front) + screws([[10, 79], [90, 79]], 1));
  if (cooking) {
    // the lid shut over the mould, a hinge, steam, the ring timer
    p.push(P(IRON, plate, ` stroke="${line(IRON, 0.3)}" stroke-width="1.2"`));
    p.push(P(lit(IRON, 0.15), 'M12 30 Q50 14 88 30 L94 64 Q50 54 6 64 Z', ` stroke="${line(IRON, 0.3)}" stroke-width="1.2"`), over('M12 30 Q50 14 88 30 L94 64 Q50 54 6 64 Z', G.box));
    p.push(S(dark(IRON, 0.3), 1.2, 'M24 34 Q50 26 76 34 M18 46 Q50 38 82 46', ' stroke-opacity=".7"') + S(PEACH, 1.2, 'M20 31 Q50 18 80 31', ' stroke-opacity=".5" stroke-linecap="round"'));
    p.push(`<path class="as-waffle-steam" fill="none" stroke="${PAPER}" stroke-width="2.6" stroke-linecap="round" stroke-opacity=".75" d="M30 20 q-4 -6 0 -12 M50 16 q-4 -6 0 -12 M70 20 q-4 -6 0 -12"/>`);
    p.push(`<circle cx="90" cy="14" r="10" fill="${NIGHT}" stroke="${INK}" stroke-width="1.2"/>`);
    p.push(`<circle class="as-waffle-timer" cx="90" cy="14" r="7" fill="none" stroke="${TAKE}" stroke-width="3.2" pathLength="100" stroke-dasharray="${r1(pct * 100)} 100" transform="rotate(-90 90 14)"/>`);
  } else {
    // open: the lid raised at the back (its own mould showing), the plate with golden balls (or empty cups)
    p.push(P(IRON, 'M14 8 H86 L90 44 H10 Z', ` stroke="${line(IRON, 0.3)}" stroke-width="1.2"`), over('M14 8 H86 L90 44 H10 Z', G.front));
    p.push(P(dark(IRON, 0.3), [0, 1, 2, 3, 4, 5].map((c) => `${ell(r1(26 + c * 9.6), 20, 3.4, 2.4)} ${ell(r1(24 + c * 10.4), 32, 3.8, 2.6)}`).join(' ')));
    p.push(P(IRON, plate, ` stroke="${line(IRON, 0.3)}" stroke-width="1.2"`), over(plate, G.top, 0.5));
    let cups = '';
    let balls = '';
    let hi = '';
    let crisp = '';
    const full = ready > 0;
    for (let r = 0; r < 3; r++) {
      const y = 52 + r * 7.4;
      const k = 0.8 + 0.2 * r;
      for (let c = 0; c < 6; c++) {
        const x = 50 + (c - 2.5) * (12 + r * 1.4);
        cups += ell(r1(x), r1(y), r1(4.6 * k), r1(2.6 * k)) + ' ';
        balls += ell(r1(x), r1(y - 1.6 * k), r1(4.8 * k), r1(4.2 * k)) + ' ';
        crisp += ell(r1(x + 0.8 * k), r1(y + 0.6 * k), r1(3.4 * k), r1(2 * k)) + ' ';
        hi += ring(r1(x - 1.6 * k), r1(y - 3.2 * k), r1(1.4 * k)) + ' ';
      }
    }
    p.push(P('#1E1412', cups));
    if (full) p.push(P(WAFFLE, balls, ` stroke="${dark(WAFFLE, 0.45)}" stroke-width=".7"`) + P('#C46E1C', crisp, ' fill-opacity=".55"') + P('#FFE6A0', hi, ' fill-opacity=".95"'));
    p.push(S('#FFFFFF', 1, 'M14 47.6 H86', ' stroke-opacity=".35"'));
  }
  // wooden handles at the front with chrome ferrules, a hinge at the back
  p.push(P(G.wood, 'M36 84 h28 v5 q0 2 -2 2 h-24 q-2 0 -2 -2 Z', ` stroke="${dark('#CF8B47', 0.4)}" stroke-width=".8"`) + P(G.chrome, 'M34 83 h3 v7 h-3 Z M63 83 h3 v7 h-3 Z'));
  p.push(P(G.chrome, 'M44 43 h12 v4 h-12 Z', ` stroke="${SL}" stroke-width=".7"`));
  if (fast) p.push(bolt(14, 60));
  return svg('as-station as-waffle', '0 0 100 90', p.join(''), ` data-cooking="${cooking ? 1 : 0}" data-ready="${ready | 0}"`);
}

/** One bag of 雞蛋糕: a red-striped paper bag with golden balls peeking out (dragged to a customer). */
export function snackBagSVG() {
  const bag = 'M10 24 H50 L47 62 H13 Z';
  return svg('as-snackbag', '0 0 60 66', ao(30, 63, 22, 4) +
    P('#FAEBCB', bag, ` stroke="${line('#F7E9C8', 0.45)}" stroke-width="1.2" stroke-linejoin="round"`) + over(bag, G.cyl) +
    P(GUN, 'M10.8 32 H49.2 L48.9 37 H11.1 Z M11.5 44 H48.5 L48.2 49 H11.8 Z') +
    S(dark('#FAEBCB', 0.2), 0.8, 'M18 26 L19 60 M42 26 L41 60', ' stroke-opacity=".5"') +
    P(WAFFLE, `${ring(20, 22, 7.4)} ${ring(36, 20, 7.8)} ${ring(28, 12, 7.2)}`, ` stroke="${dark(WAFFLE, 0.45)}" stroke-width="1"`) +
    over(`${ring(20, 22, 7.4)}`, G.sph) + over(`${ring(36, 20, 7.8)}`, G.sph) + over(`${ring(28, 12, 7.2)}`, G.sph) +
    P(PAPER_SH, 'M10 24 H50 L49 28 H11 Z') +
    S(PAPER, 1.6, 'M22 6 q-2 -3 0 -6 M34 8 q-2 -3 0 -6', ' stroke-linecap="round" stroke-opacity=".7"'));
}

/** The warmer tray next to the iron: up to 3 ready bags stand in it under a warm heat glow. */
export function snackSpotSVG(ready = 0) {
  const n = clamp(ready | 0, 0, 3);
  const top = 'M6 46 H58 L62 62 H2 Z';
  let bags = '';
  const pos = [[20, 48], [44, 48], [32, 58]].slice(0, n);
  for (const [x, y] of pos) {
    bags += P('#FAEBCB', `M${x - 9} ${y - 22} H${x + 9} L${x + 8} ${y} H${x - 8} Z`, ` stroke="${line('#F7E9C8', 0.45)}" stroke-width="1"`) +
      P(GUN, `M${x - 8.6} ${y - 15} H${x + 8.6} V${y - 12} H${x - 8.6} Z`) +
      P(WAFFLE, `${ring(x - 4, y - 23, 4)} ${ring(x + 4, y - 24, 4.2)}`, ` stroke="${dark(WAFFLE, 0.45)}" stroke-width=".7"`) +
      P('#FFE6A0', `${ring(x - 5.2, y - 24.4, 1.2)} ${ring(x + 2.8, y - 25.4, 1.2)}`);
  }
  return svg('as-station as-snackspot', '0 0 64 70', ao(32, 66, 32, 5) + P(G.glow, ell(32, 50, 34, 16)) + P(dark(STEEL, 0.2), 'M2 62 H62 L61 68 H3 Z') +
    P(G.steelTop, top, ` stroke="${SL}" stroke-width="1.1" stroke-linejoin="round"`) + S(dark(STEEL, 0.2), 0.8, 'M10 50 H54 M8 54.6 H56 M6 59 H58', ' stroke-opacity=".6"') +
    P(GUN, 'M3 61 H61 L61.6 63 H2.4 Z', ' fill-opacity=".8"') + screws([[6, 65], [58, 65]], 0.9) + S(PEACH, 1, 'M59 48 L61.6 61', ' stroke-opacity=".7"') + bags,
  ` data-ready="${n}"`);
}

/** The 提袋 spot: a kraft carry bag standing open; packed cups show their sealed lids in it. */
export function carryBagSVG(n = 0) {
  const k = clamp(n | 0, 0, 4);
  const front = 'M14 40 H86 L82 98 H18 Z';
  const p = [
    cast(50, 100, 46, 7), ao(50, 100, 46, 7),
    P(dark(KRAFT, 0.3), 'M22 30 H78 L86 40 H14 Z'),                           // the inside back
    S(dark(KRAFT, 0.45), 3, 'M34 32 Q50 2 66 32', ' stroke-linecap="round"'),  // the back handle
  ];
  const lids = [[34, 38], [66, 38], [42, 30], [60, 30]].slice(0, k);
  for (const [x, y] of lids) {
    p.push(P('#DDEFF7', `M${x - 12} ${y} L${x - 9} ${y + 14} H${x + 9} L${x + 12} ${y} Z`, ' stroke="#7FA6BC" stroke-width="1"'));
    p.push(P(PAPER, ell(x, y, 12, 4.4), ` stroke="${line(PAPER, 0.45)}" stroke-width="1"`) + P('none', ell(x, y, 7, 2.6), ` stroke="${GUN}" stroke-width="1.1"`));
  }
  p.push(P(KRAFT, front, ` stroke="${line(KRAFT, 0.45)}" stroke-width="1.2" stroke-linejoin="round"`), over(front, G.cyl));
  // the folded top band, side gussets, a paper fibre texture, the printed red round with a cup (no words), a sticker seal
  p.push(P(lit(KRAFT, 0.2), 'M14 40 H86 L85.4 48 H14.6 Z') + S(dark(KRAFT, 0.25), 0.8, 'M14.6 48 H85.4', ' stroke-opacity=".7"'));
  p.push(S(dark(KRAFT, 0.2), 1, 'M14 40 L18 98 M86 40 L82 98 M24 48 L26 98 M76 48 L74 98', ' stroke-opacity=".5"'));
  p.push(S(dark(KRAFT, 0.15), 0.6, 'M30 56 h6 M60 62 h8 M34 84 h5 M64 88 h6 M22 72 h4', ' stroke-opacity=".5" stroke-linecap="round"'));
  p.push(P(GUN, 'M38 66 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 Z', ' fill-opacity=".92"') + P(PAPER, 'M44 60 H56 L54 76 H46 Z') + S(PAPER, 1.4, 'M53 60 L56 54', ' stroke-linecap="round"'));
  p.push(P(TAKE, ring(76, 52, 3.4), ` stroke="${TAKE_DEEP}" stroke-width=".7"`));
  // the twisted paper handle at the front with its glued patches
  p.push(P(dark(KRAFT, 0.15), 'M28 42 h8 v6 h-8 Z M64 42 h8 v6 h-8 Z'));
  p.push(S(dark(KRAFT, 0.45), 3.4, 'M32 44 Q50 12 68 44', ' stroke-linecap="round"') + S(lit(KRAFT, 0.3), 1.2, 'M33 42 Q50 14 67 42', ' stroke-linecap="round" stroke-dasharray="3 2"'));
  if (k) p.push(P(MINT, ring(86, 30, 9), ` stroke="${INK}" stroke-width="1.6"`) + `<text x="86" y="34.4" ${FONT_NUM} font-size="12" text-anchor="middle" fill="${PAPER}">${k}</text>`);
  return svg('as-station as-carrybag', '0 0 100 105', p.join(''), ` data-n="${k}"`);
}

// ─── Table dressing (decoration only, no words) ────────────────────────────────────────────────
export function fridgeSVG() {
  // a glass-door drinks fridge on the left wall, seen at an angle: its warm-lit inside, shelves of bottles and cans,
  // a door gasket, a chrome handle, a red header with a light strip, feet and a magnet sticker
  const rnd = mulberry32(fnv1a('fridge'));
  const colors = [GUN, TAKE, MINT, '#2FB2F0', SHUT, '#FF5FA2', '#FF8A2A'];
  const byC = colors.map(() => '');
  let caps = '';
  let shine = '';
  for (let s = 0; s < 4; s++) {
    const y = 74 + s * 52;
    for (let i = 0; i < 3; i++) {
      const x = 16 + i * 11 + s * 0.6;
      const c = Math.floor(rnd() * colors.length);
      byC[c] += `M${r1(x)} ${y} V${y - 22} Q${r1(x)} ${y - 28} ${r1(x + 3)} ${y - 30} V${y - 36} h3 V${y - 30} Q${r1(x + 9)} ${y - 28} ${r1(x + 9)} ${y - 22} V${y} Z `;
      caps += `M${r1(x + 2.6)} ${y - 38} h3.8 v2.4 h-3.8 Z `;
      shine += `M${r1(x + 1.6)} ${y - 20} h1.6 v16 h-1.6 Z `;
    }
  }
  const body = 'M0 0 L62 14 V298 L0 300 Z';
  const glass = 'M8 22 L54 32 V262 L8 270 Z';
  return svg('as-fridge', '0 0 62 300', P('#F7EADB', body, ` stroke="${SL}" stroke-width="1.2"`) + over(body, G.cylSoft) +
    P('#FFF1D8', glass) + `<path fill="url(#gkGlow)" d="${glass}"/>` +
    S('#FFFFFF', 1.6, 'M10 74 L52 78 M10 126 L52 130 M10 178 L52 182 M10 230 L52 234', ' stroke-opacity=".85"') +
    byC.map((d, i) => (d ? P(colors[i], d, ` stroke="${line(colors[i], 0.45)}" stroke-width=".8"`) : '')).join('') +
    P(CHOC, caps) + P('#FFFFFF', shine, ' fill-opacity=".55"') +
    over(glass, G.glass) + P('#FFFFFF', 'M14 30 L22 31.6 L12 160 L8 160 L8 60 Z', ' fill-opacity=".3"') + S('#B9A79A', 2.4, glass) +
    P(G.chrome, 'M48 120 h4 v60 h-4 Z', ` stroke="${SL}" stroke-width=".8"`) +
    P(GUN, 'M4 4 L58 16 V24 L4 14 Z') + over('M4 4 L58 16 V24 L4 14 Z', G.front) + P('#FFE9B8', 'M8 14.6 L54 24.6 V26 L8 16 Z', ' fill-opacity=".9"') +
    P(GOLD_HI, 'M14 8 l3 1 -1 3 Z M30 11 l3 1 -1 3 Z', ' fill-opacity=".8"') +
    P('#FF5FA2', 'M56 60 C52 56 54 52 56.6 54.6 C59 52 61 56 57 60 Z', ' stroke="#FFFFFF" stroke-width="1"') +
    P(CHOC_LO, 'M4 298 h8 v2 h-8 Z M48 296 h8 v2 h-8 Z'));
}

export function lightBoxSVG() {
  // a backlit menu stand: three glowing drink pictures and a golden 250 cup, no words; a chocolate frame with screws
  const cups = [[22, '#C99566'], [47, '#CBD97E'], [72, '#9BD957']].map(([x, c]) =>
    P(c, `M${x - 9} 22 H${x + 9} L${x + 7} 48 H${x - 7} Z`, ` stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"`) + over(`M${x - 9} 22 H${x + 9} L${x + 7} 48 H${x - 7} Z`, G.cyl) +
    P('#2B1A12', `${ring(x - 4, 44, 1.8)} ${ring(x, 45, 1.8)} ${ring(x + 4, 44, 1.8)}`) + S(INK, 1.4, `M${x + 4} 22 L${x + 7} 15`, ' stroke-linecap="round"')).join('');
  const frame = 'M4 6 H90 V82 H4 Z';
  return svg('as-lightbox', '0 0 94 104', cast(47, 100, 44, 5) + ao(47, 100, 44, 5) + P(G.steelTop, 'M30 82 H64 L70 98 H24 Z', ` stroke="${SL}" stroke-width=".8"`) +
    P(CHOC, frame, ` stroke="${CHOC_LO}" stroke-width="1.4"`) + over(frame, G.front) +
    P('#FFF4D6', 'M9 11 H85 V77 H9 Z') + `<path fill="url(#gkGlow)" d="M9 11 H85 V77 H9 Z"/>` + cups +
    P(G.gold, 'M39 56 H55 L53 72 H41 Z', ` stroke="${INK}" stroke-width="1.2"`) + P(GOLD_HI, 'M59 56 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6 Z') +
    P(GUN, 'M14 58 h18 v6 h-18 Z M14 68 h12 v4 h-12 Z M64 68 h16 v4 h-16 Z') + over(frame, G.box, 0.4) +
    screws([[6.6, 8.6], [87.4, 8.6], [6.6, 79.4], [87.4, 79.4]], 1) + S('#FFFFFF', 1, 'M10 12 H84', ' stroke-opacity=".7"'));
}

export function fanSVG() {
  // a retro desk fan: a coral base and motor, a chrome guard, peach blades (g.as-fan-blades spins in CSS round 29, 26)
  const CORAL = '#F0806A';
  return svg('as-fan', '0 0 58 72', ao(29, 69, 22, 4) + P(CORAL, ell(29, 64, 16, 5), ` stroke="${dark(CORAL, 0.4)}" stroke-width="1"`) + over(ell(29, 64, 16, 5), G.top) +
    P(GOLD_HI, ring(36, 64, 1.4)) + P(G.steel, 'M27 40 h4 v24 h-4 Z') + P(CORAL, 'M24 44 h10 v6 h-10 Z', ` stroke="${dark(CORAL, 0.4)}" stroke-width=".8"`) +
    P('#FFF2E2', ring(29, 26, 22), ` stroke="${SL}" stroke-width="1.4"`) + over(ring(29, 26, 22), G.sph, 0.5) +
    `<g class="as-fan-blades">${P('#FFB38A', 'M29 26 Q20 8 29 6 Q36 12 29 26 Z M29 26 Q47 20 48 30 Q40 36 29 26 Z M29 26 Q20 42 12 36 Q14 26 29 26 Z', ` fill-opacity=".9" stroke="${dark('#FFB38A', 0.3)}" stroke-width=".6"`)}</g>` +
    P(CORAL, ring(29, 26, 4), ` stroke="${dark(CORAL, 0.4)}" stroke-width="1"`) + P('#FFFFFF', ring(28, 25, 1.2), ' fill-opacity=".8"') +
    S(SL, 0.8, `${ring(29, 26, 15)} ${ring(29, 26, 8)} M29 4 V48 M7 26 H51 M13.4 10.4 L44.6 41.6 M44.6 10.4 L13.4 41.6`, ' stroke-opacity=".45"'));
}

export function registerSVG() {
  // the cash register on the front worktop, seen from above: key pad, display, a receipt curling out, the drawer
  const front = 'M6 66 H126 V98 H6 Z';
  return svg('as-register', '0 0 132 106', cast(66, 102, 64, 6) + ao(66, 102, 64, 6) +
    P(CHOC_LO, 'M10 98 h10 v4 h-10 Z M112 98 h10 v4 h-10 Z') +
    P(PAPER, front, ` stroke="${line(PAPER, 0.45)}" stroke-width="1.2"`) + over(front, G.front) + P(PAPER_SH, 'M6 86 H126 V98 H6 Z') +
    S(line(PAPER, 0.5), 1.4, 'M6 86 H126') + P(G.chrome, 'M52 90 H80 V94 H52 Z', ` stroke="${SL}" stroke-width=".7"`) + screws([[10, 70], [122, 70]], 1) +
    P(GUN, 'M14 66 L26 30 H106 L118 66 Z', ` stroke="${GUN_DEEP}" stroke-width="1.2" stroke-linejoin="round"`) + over('M14 66 L26 30 H106 L118 66 Z', G.top) + over('M14 66 L26 30 H106 L118 66 Z', G.sheen, 0.6) +
    P('#FFF4E2', [0, 1, 2, 3].flatMap((c) => [0, 1].map((r) => `M${36 + c * 16 + r * 3} ${40 + r * 11} h12 v7 h-12 Z`)).join(' '), ` stroke="${GUN_DEEP}" stroke-width=".6"`) +
    P(MINT, 'M27 56 h10 v6 h-10 Z', ` stroke="${dark(MINT, 0.4)}" stroke-width=".6"`) +
    P('#FFFFFF', 'M84 12 V2 Q84 0 86 0 H112 Q114 0 114 2 V12 Z', ` stroke="${line(PAPER, 0.4)}" stroke-width=".8"`) + S('#C9B8A4', 0.8, 'M88 4 H108 M88 7 H104', ' stroke-linecap="round"') +
    P(G.steel, 'M78 30 V12 H122 V30 Z', ` stroke="${SL}" stroke-width="1.1"`) + P(NIGHT, 'M82 15 H118 V26 H82 Z') +
    `<text x="100" y="24.6" font-family="'DSEG7 Classic', monospace" font-size="8" text-anchor="middle" fill="${MINT}">250</text>` +
    P('#FFFFFF', 'M84 16 h4 l-3 9 h-2 Z', ' fill-opacity=".25"'));
}

export function cashTraySVG() {
  // a wooden coin tray with two compartments, gold coins and a folded note
  const top = 'M6 12 H64 L68 40 H2 Z';
  let coins = '';
  for (const [x, y, r] of [[16, 28, 6], [28, 24, 6.4], [22, 34, 5.4]]) coins += ell(x, y, r, r * 0.55) + ' ';
  let coins2 = '';
  for (const [x, y, r] of [[48, 30, 6], [58, 25, 5.6], [52, 36, 5.8]]) coins2 += ell(x, y, r, r * 0.55) + ' ';
  const all = coins + coins2;
  return svg('as-cashtray', '0 0 70 52', ao(35, 46, 34, 6) + P(dark('#CF8B47', 0.3), 'M2 40 H68 L67 46 H3 Z') +
    P(G.wood, top, ` stroke="${dark('#CF8B47', 0.45)}" stroke-width="1"`) + P(dark('#CF8B47', 0.2), 'M10 16 H33 L32 37 H6 Z M37 16 H60 L64 37 H38 Z') + over('M10 16 H60 L64 37 H6 Z', G.inner, 0.8) +
    P('#9AD0A2', 'M36 20 L50 16 L54 24 L40 28 Z', ' stroke="#4E8A5A" stroke-width=".7"') +
    P(G.gold, all, ` stroke="${TAKE_DEEP}" stroke-width=".8"`) + P(GOLD_HI, all.replace(/a([\d.]+) ([\d.]+)/g, (m, a, b) => `a${r1(a * 0.5)} ${r1(b * 0.5)}`), ' fill-opacity=".7"') +
    S('#FFE6B8', 1, 'M7 12.8 H63', ' stroke-opacity=".8"'));
}

export function tipJarSVG() {
  // a glass jar with coins and folded notes (no words), a red ribbon with a heart, a warm steel lid with a slot
  const jar = 'M10 22 Q10 16 16 16 H46 Q52 16 52 22 V70 Q52 76 46 76 H16 Q10 76 10 70 Z';
  return svg('as-tipjar', '0 0 62 80', cast(31, 78, 26, 4) + ao(31, 78, 26, 4) +
    P('#EAF4F6', jar, ' fill-opacity=".45"') +
    P(G.gold, `${ell(22, 68, 7, 3)} ${ell(36, 66, 7, 3)} ${ell(28, 62, 6.4, 2.8)} ${ell(42, 60, 6, 2.6)} ${ell(18, 58, 5, 2.2)}`, ` stroke="${TAKE_DEEP}" stroke-width=".8"`) +
    P('#9AD0A2', 'M16 54 L30 46 L36 56 L22 62 Z', ' stroke="#4E8A5A" stroke-width=".8"') + P('#F7A8B4', 'M30 50 L46 44 L48 54 L34 58 Z', ' stroke="#B8606E" stroke-width=".8"') +
    over(jar, G.glass) + S('#A9C3CC', 1.2, jar) + P('#FFFFFF', 'M14 24 h3 v44 h-3 Z', ' fill-opacity=".5"') +
    P(G.steelTop, ell(31, 16, 21, 5), ` stroke="${SL}" stroke-width="1"`) + P(NIGHT, 'M24 15 h14 v2.4 h-14 Z') +
    P(GUN, 'M10 30 H52 V36 H10 Z', ' fill-opacity=".92"') + P('#FFFFFF', 'M31 37 C26 33 28 29 31 31.6 C34 29 36 33 31 37 Z', ' fill-opacity=".9"') + P(GUN, 'M28 33 l-6 10 h5 l3 -6 l3 6 h5 l-6 -10 Z'));
}

export function towerStandSVG() {
  // a round wooden stand under the cup tower: a red trim band, a gold edge, wood grain on top
  return svg('as-towerstand', '0 0 130 40', ao(65, 32, 64, 8) + P(G.wood, 'M6 16 V26 A59 11 0 0 0 124 26 V16 Z', ` stroke="${line('#CF8B47', 0.45)}" stroke-width="1.2"`) +
    over('M6 16 V26 A59 11 0 0 0 124 26 V16 Z', G.cyl) + P('#ECB878', ell(65, 16, 59, 11), ` stroke="${line('#CF8B47', 0.45)}" stroke-width="1.2"`) + over(ell(65, 16, 59, 11), G.top) +
    S(dark('#CF8B47', 0.1), 0.8, `${ell(65, 16, 44, 8)} ${ell(65, 16, 28, 5)}`, ' stroke-opacity=".45"') +
    P(GUN, 'M6 22 A59 11 0 0 0 124 22 V24 A59 11 0 0 1 6 24 Z', ' fill-opacity=".9"') + S(G.gold, 0.9, 'M6.4 21.4 A59 11 0 0 0 123.6 21.4', ' stroke-opacity=".9"') +
    S('#FFFFFF', 1.2, 'M20 10 Q40 6 64 5.4', ' stroke-opacity=".6" stroke-linecap="round"'));
}

void STEEL_HI; void STEEL_LO; void PEACH;
