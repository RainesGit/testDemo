// art-shop.js — gameplay v3 drink-making work area art (docs/gameplay-v3-shop.md §2–3) as SVG strings.
// Pure string templates: no DOM, no randomness except seeded (same input -> same output), safe in node tests.
// Style follows docs/art-direction-v2.md and src/art.js: §2.1 palette tokens (PALETTE from art.js), two-step cel
// shading (celShade = cool purple shadow, celHilite = warm highlight), warm light from the upper left (shadows on
// the right and below), props outlined in the warm --ink-bg, the hero cup and the order bubble in --ink. Only
// drinks are green (§2.1). No filters, no blur, no external images; gradients only on the big backdrop.
//
// ─── Export contract (consumed by the v3 shop UI) ──────────────────────────────────────────────
//   cupSVG({ tea, toppings, ice, sugar, sealed })   <svg class="as-cup">, viewBox 0 0 100 160 (1:1.6).
//       tea: null | 'black' | 'green' | 'jade'; toppings: up to 3 of 'pearl' | 'coconut' | 'pudding' | 'grass'
//       (first = bottom layer); ice 0..2; sugar 0..2; sealed: printed film lid with the 250 logo + straw spot.
//       data-tea / data-sealed on the <svg>. The cup bottom sits at y ≈ 153.
//   teaTankSVG(kind)                       <svg class="as-station as-tank" data-kind>, viewBox 0 0 100 140, label 紅茶/綠茶/翡翠檸檬
//   toppingTraySVG(kind, scoopsLeft = 10)  <svg class="as-station as-tray" data-kind data-left>, viewBox 0 0 100 90
//   iceBinSVG()                            <svg class="as-station as-ice">, viewBox 0 0 100 90
//   syrupSVG()                             <svg class="as-station as-syrup">, viewBox 0 0 70 130, label 果糖
//   sealerSVG(state = 'idle')              <svg class="as-station as-sealer" data-state="idle|busy">, viewBox 0 0 110 150;
//                                          the cup stands on the plate at (55, 136); g.as-sealer-head moves down when busy
//   potSVG({ scoops, cookingPct })         <svg class="as-station as-pot" data-scoops data-cooking>, viewBox 0 0 110 110;
//                                          circle.as-pot-timer (pathLength 100) is the ring timer while cooking
//   cupRackSVG()                           <svg class="as-station as-rack">, viewBox 0 0 100 110
//   trashSVG()                             <svg class="as-station as-trash">, viewBox 0 0 80 110
//   workSlotSVG()                          <svg class="as-station as-slot">, viewBox 0 0 100 50 (cup centre at x 50, y ≈ 25)
//   orderBubbleSVG({ tea, toppings, ice, sugar, count })   <svg class="as-bubble">, viewBox 0 0 120 100, tail at
//                                          the bottom left (tip at 22, 98); icons only, a ×N badge when count > 1
//   coinSVG()                              <svg class="as-coin">, viewBox 0 0 40 40
//   patienceRingSVG(pct)                   <svg class="as-patience" data-pct>, viewBox 0 0 40 40; circle.as-pr-arc
//   counterBackdropSVG()                   <svg class="as-backdrop">, viewBox 0 0 360 300 (slice): tile backsplash under
//                                          warm light, steel back counter top at y 150–166, steel cabinets below
//   TEA_KINDS, TOPPING_KINDS, TEA_COLORS, ART_SHOP_VERSION

import { PALETTE, mixColor, celShade, celHilite, ringPath, mulberry32, fnv1a } from '../art.js';

export const ART_SHOP_VERSION = 1;

const { INK, INK_BG, PAPER, PAPER_SH, GUN, GUN_DEEP, TAKE, TAKE_DEEP, LEMON, GOLD_HI, MINT, STEEL_HI, STEEL, STEEL_LO,
  NIGHT_700, COUNTER, COUNTER_LO, WARM_RIM } = PALETTE;

export const TEA_KINDS = ['black', 'green', 'jade'];
export const TOPPING_KINDS = ['pearl', 'coconut', 'pudding', 'grass'];

// Drink colours (drinks only). body / shadow / surface highlight, plus the label colour of each tank.
export const TEA_COLORS = {
  black: { body: '#C8915C', label: '#8A4A24', name: '紅茶' }, // caramel-brown milk tea
  green: { body: '#CFE39A', label: '#5E9A48', name: '綠茶' }, // pale jade green tea
  jade: { body: '#93DB52', label: '#2E9E46', name: '翡翠檸檬' }, // bright lime + lemon
};
const TOPPING_NAME = { pearl: '珍珠', coconut: '椰果', pudding: '布丁', grass: '仙草' };
const PEARL = '#2B1A12';
const PEARL_HI = '#8A5A3C';
const COCO = '#F4ECCB';
const PUDDING = '#F6C356';
const CARAMEL = '#A9561C';
const GRASS = '#2A2A1E';
const GRASS_HI = '#5B5C3E';
const ICE = '#E6F6FF';
const ICE_EDGE = '#86BCD8';
const SYRUP = '#E9A23B';

const FONT_ZH = `font-family="Huninn, 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"`;
const FONT_NUM = `font-family="'Baloo 2', 'Noto Sans TC', sans-serif" font-weight="800"`;

const r1 = (n) => Math.round(n * 10) / 10;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const int = (v, lo, hi, d = lo) => clamp(Math.round(Number.isFinite(Number(v)) ? Number(v) : d), lo, hi);
const svg = (cls, vb, body, attrs = '') => `<svg class="${cls}" viewBox="${vb}" overflow="visible" aria-hidden="true"${attrs}>${body}</svg>`;
// A rotated square (cx, cy, side s, angle a in degrees) as a path fragment.
function sq(cx, cy, s, a) {
  const t = (a * Math.PI) / 180;
  const h = s / 2;
  const pts = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => `${r1(cx + x * Math.cos(t) - y * Math.sin(t))} ${r1(cy + x * Math.sin(t) + y * Math.cos(t))}`);
  return `M${pts[0]} L${pts[1]} L${pts[2]} L${pts[3]} Z`;
}
// Centred positions from a to b, step apart; odd rows get one fewer (a half-step stagger like a real pile).
function spread(a, b, step, odd) {
  let n = Math.max(1, Math.floor((b - a) / step) + 1);
  if (odd && n > 1) n -= 1;
  const start = (a + b) / 2 - ((n - 1) * step) / 2;
  return Array.from({ length: n }, (_, i) => start + i * step);
}
const ell = (cx, cy, rx, ry) => `M${r1(cx - rx)} ${r1(cy)} a${rx} ${ry} 0 1 0 ${r1(2 * rx)} 0 a${rx} ${ry} 0 1 0 ${r1(-2 * rx)} 0`;

// ─── The cup (hero) ────────────────────────────────────────────────────────────────────────────
const RIM_Y = 24;
const BOT_Y = 150;
const RIM_X = 13; // left rim x (right = 100 - x)
const BOT_X = 24;
const wallX = (y) => RIM_X + ((y - RIM_Y) * (BOT_X - RIM_X)) / (BOT_Y - RIM_Y); // left inner wall at y
const SURF_Y = 42; // tea surface
const LAYER_H = 15; // one topping scoop
const IN_BOT = 148; // inside bottom

function normCup(o = {}) {
  const tea = TEA_KINDS.includes(o.tea) ? o.tea : null;
  const toppings = (Array.isArray(o.toppings) ? o.toppings : []).filter((t) => TOPPING_KINDS.includes(t)).slice(0, 3);
  return { tea, toppings, ice: int(o.ice, 0, 2, 0), sugar: int(o.sugar, 0, 2, 0), sealed: !!o.sealed };
}

// Topping layer i (0 = bottom): returns { fill paths } fragments by colour so a cup stays within its node budget.
function toppingLayer(kind, i, seed, top = false) {
  const yB = IN_BOT - i * LAYER_H;
  let yT = yB - LAYER_H;
  const xl = wallX(yB) + 2.5;
  const xr = 100 - wallX(yB) - 2.5;
  const rnd = mulberry32(seed);
  if (kind === 'pearl') {
    const r = 5;
    let d = '';
    let g = '';
    let rim = '';
    // the top layer of pearls mounds up one extra row (a generous scoop)
    for (let row = 0; row < (top ? 3 : 2); row++) {
      const y = yB - r - row * 7.4;
      for (const x of spread(wallX(y) + 2.5 + r, 100 - wallX(y) - 2.5 - r, 9.6, row % 2)) {
        const jx = r1(x + (rnd() - 0.5) * 1.2);
        const jy = r1(y + (rnd() - 0.5) * 1.2);
        d += ringPath(jx, jy, r) + ' ';
        g += ringPath(r1(jx - 1.7), r1(jy - 1.8), 1.4) + ' ';
        rim += `M${r1(jx + 1.2)} ${r1(jy + 3.6)} q2.8 -1.2 3.1 -4 `;
      }
    }
    return `<path fill="${PEARL}" stroke="${INK}" stroke-width=".7" d="${d}"/>` +
      `<path fill="none" stroke="${PEARL_HI}" stroke-width="1" stroke-linecap="round" d="${rim}"/>` +
      `<path fill="#FFFFFF" fill-opacity=".75" d="${g}"/>`;
  }
  if (kind === 'coconut') {
    let d = '';
    let g = '';
    for (let row = 0; row < 2; row++) {
      const y = yB - 4.6 - row * 7;
      for (const x of spread(xl + 4.6, xr - 4.6, 8.6, row % 2)) {
        const a = (rnd() - 0.5) * 40;
        d += sq(r1(x + (rnd() - 0.5)), y, 7.4, a) + ' ';
        g += sq(r1(x - 1.5), r1(y - 1.5), 2.4, a) + ' ';
      }
    }
    return `<path fill="${COCO}" fill-opacity=".86" stroke="#B9A673" stroke-width=".8" stroke-linejoin="round" d="${d}"/><path fill="#FFFFFF" fill-opacity=".8" d="${g}"/>`;
  }
  if (kind === 'pudding') {
    yT -= 3; // a custard block stands a little taller than a scoop
    const xlT = wallX(yT) + 3.5;
    const xrT = 100 - wallX(yT) - 3.5;
    const body = `M${r1(xl + 1)} ${yB} L${r1(xlT + 3)} ${r1(yT + 2)} Q${r1((xlT + xrT) / 2)} ${r1(yT - 1)} ${r1(xrT - 3)} ${r1(yT + 2)} L${r1(xr - 1)} ${yB} Z`;
    const top = `M${r1(xlT + 3)} ${r1(yT + 2)} Q${r1((xlT + xrT) / 2)} ${r1(yT - 1)} ${r1(xrT - 3)} ${r1(yT + 2)} L${r1(xrT - 2.6)} ${r1(yT + 5)} Q${r1((xlT + xrT) / 2 + 6)} ${r1(yT + 3)} ${r1((xlT + xrT) / 2)} ${r1(yT + 6.5)} Q${r1(xlT + 10)} ${r1(yT + 3.5)} ${r1(xlT + 3.4)} ${r1(yT + 5)} Z`;
    return `<path fill="${PUDDING}" stroke="#B8801E" stroke-width=".9" stroke-linejoin="round" d="${body}"/>` +
      `<path fill="${CARAMEL}" d="${top}"/>` +
      `<path fill="#FFF2C8" fill-opacity=".7" d="M${r1(xl + 6)} ${yB - 2.5} L${r1(xlT + 7)} ${r1(yT + 7)} h2.6 L${r1(xl + 9)} ${yB - 2.5} Z"/>`;
  }
  // grass jelly
  let d = '';
  let g = '';
  for (let row = 0; row < 2; row++) {
    const y = yB - 4.8 - row * 7.2;
    for (const x of spread(xl + 4.8, xr - 4.8, 8.8, row % 2)) {
      const a = (rnd() - 0.5) * 30;
      d += sq(r1(x), r1(y + (rnd() - 0.5)), 7.8, a) + ' ';
      g += `M${r1(x - 2.6)} ${r1(y - 1.2)} l2 -1.6 ` ;
    }
  }
  return `<path fill="${GRASS}" stroke="${INK}" stroke-width=".7" stroke-linejoin="round" d="${d}"/><path fill="none" stroke="${GRASS_HI}" stroke-width="1.3" stroke-linecap="round" d="${g}"/>`;
}

// Liquid body from the surface (sy) down to the bottom, following the cup walls.
function liquidPath(sy) {
  const xl = wallX(sy);
  return `M${r1(xl + 0.6)} ${sy} L${BOT_X + 0.6} ${BOT_Y} Q50 ${BOT_Y + 5} ${100 - BOT_X - 0.6} ${BOT_Y} L${r1(100 - xl - 0.6)} ${sy} Z`;
}

export function cupSVG(opts = {}) {
  const c = normCup(opts);
  const seed = fnv1a(JSON.stringify(c));
  const parts = [];
  const tea = c.tea ? TEA_COLORS[c.tea] : null;
  const topY = IN_BOT - c.toppings.length * LAYER_H; // top of the topping pile
  // back of the cup: the inner rim and a faint plastic tint
  parts.push(`<path fill="#DDEFF7" fill-opacity=".22" d="M${RIM_X} ${RIM_Y} L${BOT_X} ${BOT_Y} Q50 ${BOT_Y + 5} ${100 - BOT_X} ${BOT_Y} L${100 - RIM_X} ${RIM_Y} Z"/>`);
  parts.push(`<path fill="none" stroke="${INK}" stroke-width="1.4" stroke-opacity=".55" d="M${RIM_X} ${RIM_Y} A${50 - RIM_X} 6.5 0 0 1 ${100 - RIM_X} ${RIM_Y}"/>`);
  if (tea) {
    const body = tea.body;
    const sw = (100 - 2 * wallX(SURF_Y)) / 2 - 0.6;
    parts.push(`<path fill="${body}" d="${liquidPath(SURF_Y)}"/>`);
    // cel shadow on the right, along the wall
    const xr = 100 - wallX(SURF_Y);
    parts.push(`<path fill="${celShade(body)}" d="M${r1(xr - 11)} ${SURF_Y + 2} Q${r1(xr - 7)} 96 ${100 - BOT_X - 9} ${BOT_Y + 2.4} Q${100 - BOT_X - 2} ${BOT_Y + 1} ${100 - BOT_X - 0.6} ${BOT_Y} L${r1(xr - 0.6)} ${SURF_Y} Z"/>`);
    if (c.tea === 'black') {
      // creamy milk swirl band under the surface
      parts.push(`<path fill="${celHilite(body)}" fill-opacity=".85" d="M${r1(wallX(SURF_Y) + 1)} ${SURF_Y + 3} L${r1(wallX(64) + 0.6)} 64 Q34 58 46 63 Q60 69 72 61 Q80 57 ${r1(100 - wallX(62) - 0.6)} 62 L${r1(100 - wallX(SURF_Y) - 1)} ${SURF_Y + 3} Z"/>`);
    } else if (c.tea === 'jade') {
      // lemon wheel pressed to the front wall
      const lx = 35;
      const ly = 76;
      parts.push(`<path fill="#FFF6C8" stroke="#E2A800" stroke-width="2.4" d="${ringPath(lx, ly, 14)}"/>`);
      const seg = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = (k * Math.PI) / 4 + 0.2; return `M${lx} ${ly} L${r1(lx + Math.cos(a) * 11)} ${r1(ly + Math.sin(a) * 11)}`; }).join(' ');
      parts.push(`<path fill="${LEMON}" stroke="#FFF6C8" stroke-width="1.5" d="${ringPath(lx, ly, 11)} ${seg}"/>`);
    } else {
      // green tea: a lighter band near the top (clear tea glowing in the warm light)
      parts.push(`<path fill="${celHilite(body)}" fill-opacity=".7" d="M${r1(wallX(SURF_Y) + 1)} ${SURF_Y + 3} L${r1(wallX(70) + 0.6)} 70 Q50 64 ${r1(100 - wallX(70) - 0.6)} 70 L${r1(100 - wallX(SURF_Y) - 1)} ${SURF_Y + 3} Z"/>`);
    }
    // surface
    parts.push(`<path fill="${celHilite(body)}" stroke="${celShade(body)}" stroke-width="1" d="${ell(50, SURF_Y, sw, 5.2)}"/>`);
  }
  // toppings, bottom first
  c.toppings.forEach((k, i) => parts.push(toppingLayer(k, i, seed + i * 7919, i === c.toppings.length - 1)));
  // sugar: a thin amber syrup swirl (one per level)
  if (c.sugar > 0) {
    const sy = tea ? Math.min(topY - 8, 112) : topY - 2;
    const sw = [`M30 ${sy} q8 -7 16 -1 t16 -1 t10 3`, `M28 ${sy - 14} q9 6 18 0 t18 -1`].slice(0, c.sugar).join(' ');
    parts.push(`<path fill="none" stroke="${tea ? '#FFE3A0' : SYRUP}" stroke-width="1.8" stroke-linecap="round" stroke-opacity="${tea ? 0.5 : 0.85}" d="${sw}"/>`);
  }
  // ice: floats at the surface (or sits on the pile in an empty cup)
  if (c.ice > 0) {
    const iy = tea ? SURF_Y + 2 : Math.min(topY, IN_BOT) - 6;
    const spots = [[38, iy, -14], [61, iy + 1.5, 18], [49, iy + 14, 8], [68, iy + 17, -22]].slice(0, c.ice * 2);
    const d = spots.map(([x, y, a]) => sq(x, y, 15, a)).join(' ');
    const g = spots.map(([x, y, a]) => sq(r1(x - 2.8), r1(y - 2.8), 5.2, a)).join(' ');
    parts.push(`<path fill="${ICE}" fill-opacity=".72" stroke="${ICE_EDGE}" stroke-width="1.2" stroke-linejoin="round" d="${d}"/><path fill="#FFFFFF" fill-opacity=".9" d="${g}"/>`);
  }
  // front: plastic glints, base ridge, outline, rim
  parts.push(`<path fill="#FFFFFF" fill-opacity=".5" d="M${RIM_X + 6} ${RIM_Y + 8} L${BOT_X + 4} ${BOT_Y - 8} L${BOT_X + 8} ${BOT_Y - 8} L${RIM_X + 11} ${RIM_Y + 8} Z"/>`);
  parts.push(`<path fill="#FFFFFF" fill-opacity=".28" d="M${100 - RIM_X - 12} ${RIM_Y + 10} L${100 - BOT_X - 9} ${BOT_Y - 30} L${100 - BOT_X - 7} ${BOT_Y - 30} L${100 - RIM_X - 9.5} ${RIM_Y + 10} Z"/>`);
  parts.push(`<path fill="none" stroke="${INK}" stroke-width="1.2" stroke-opacity=".45" d="M${r1(wallX(141))} 141 Q50 146 ${r1(100 - wallX(141))} 141"/>`);
  parts.push(`<path fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" d="M${RIM_X} ${RIM_Y} L${BOT_X} ${BOT_Y} Q50 ${BOT_Y + 5} ${100 - BOT_X} ${BOT_Y} L${100 - RIM_X} ${RIM_Y}"/>`);
  if (c.sealed) {
    // printed film: paper base, red ring print, gold 250, straw poke spot; crimped rim
    parts.push(`<path fill="${PAPER}" stroke="${INK}" stroke-width="2.6" d="${ell(50, RIM_Y, 50 - RIM_X, 6.5)}"/>`);
    parts.push(`<path fill="none" stroke="${GUN}" stroke-width="1.6" d="${ell(50, RIM_Y, 30, 4.4)}"/>`);
    parts.push(`<text x="44" y="${RIM_Y + 2.4}" ${FONT_NUM} font-size="9" text-anchor="middle" fill="${GUN}" transform="translate(0 ${r1(RIM_Y * 0.45)}) scale(1 .55)" textLength="20">250</text>`);
    parts.push(`<path fill="${PAPER_SH}" stroke="${INK}" stroke-width=".9" d="${ell(66, RIM_Y - 0.2, 4, 1.8)}"/>`);
    parts.push(`<path fill="none" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round" d="M${RIM_X + 8} ${RIM_Y - 2} Q30 ${RIM_Y - 5.2} 44 ${RIM_Y - 5.6}"/>`);
  } else {
    parts.push(`<path fill="none" stroke="${INK}" stroke-width="2.6" d="M${RIM_X} ${RIM_Y} A${50 - RIM_X} 6.5 0 0 0 ${100 - RIM_X} ${RIM_Y}"/>`);
    parts.push(`<path fill="none" stroke="#FFFFFF" stroke-width="1.3" stroke-opacity=".8" stroke-linecap="round" d="M${RIM_X + 6} ${RIM_Y + 3.4} Q24 ${RIM_Y + 5.6} 34 ${RIM_Y + 6.2}"/>`);
  }
  // soft contact shadow under the cup
  const shadow = `<path fill="#1B1311" fill-opacity=".28" d="${ell(50, BOT_Y + 3.4, 30, 3.6)}"/>`;
  return svg('as-cup', '0 0 100 160', shadow + parts.join(''), ` data-tea="${c.tea || ''}" data-sealed="${c.sealed ? 1 : 0}"`);
}

// ─── Stations ──────────────────────────────────────────────────────────────────────────────────
const SW = 2.2; // prop outline (≈ 0.45cqw at station size), --ink-bg
const steelBody = (d) => `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="${SW}" stroke-linejoin="round" d="${d}"/>`;
const label = (x, y, text, size, fill = INK, extra = '') => `<text x="${x}" y="${y}" ${FONT_ZH} font-size="${size}" text-anchor="middle" fill="${fill}"${extra}>${text}</text>`;

export function teaTankSVG(kind = 'black', { fast = false } = {}) {
  const k = TEA_KINDS.includes(kind) ? kind : 'black';
  const t = TEA_COLORS[k];
  const long = t.name.length > 2;
  const icon = k === 'jade'
    ? `<path fill="${LEMON}" stroke="#E2A800" stroke-width="1.2" d="${ringPath(75, 43, 4.6)}"/>`
    : `<path fill="${k === 'green' ? '#BFE38A' : '#E7B98A'}" stroke="none" d="M70 41 Q70 31 79 30 Q79 40 70 41 Z"/>`;
  const body = [
    `<path fill="#1B1311" fill-opacity=".25" d="${ell(50, 134, 34, 4)}"/>`,
    // feet + tap block
    `<path fill="${STEEL_LO}" stroke="${INK_BG}" stroke-width="${SW}" stroke-linejoin="round" d="M20 112 h10 v20 h-10 Z M70 112 h10 v20 h-10 Z"/>`,
    steelBody('M14 26 Q14 18 22 18 H78 Q86 18 86 26 V108 Q86 114 80 114 H20 Q14 114 14 108 Z'),
    `<path fill="${celShade(STEEL)}" d="M72 19.5 H78 Q84.8 19.5 84.8 26 V108 Q84.8 112.8 80 112.8 H72 Z"/>`,
    `<path fill="${STEEL_HI}" d="M19 24 h5 v84 h-5 Z"/>`,
    // lid
    `<path fill="${STEEL_HI}" stroke="${INK_BG}" stroke-width="${SW}" stroke-linejoin="round" d="M18 19 Q20 7 50 7 Q80 7 82 19 Z M44 7 V3 Q44 1 46 1 H54 Q56 1 56 3 V7"/>`,
    // label plate in the tea's colour
    `<path fill="${t.label}" stroke="${INK_BG}" stroke-width="1.6" stroke-linejoin="round" d="M20 28 H80 Q83 28 83 31 V55 Q83 58 80 58 H20 Q17 58 17 55 V31 Q17 28 20 28 Z"/>`,
    icon,
    label(long ? 45 : 46, long ? 48.6 : 51, t.name, long ? 12 : 19, PAPER, long ? ' textLength="48" lengthAdjust="spacingAndGlyphs"' : ''),
    // sight glass with the tea level
    `<path fill="${NIGHT_700}" stroke="${INK_BG}" stroke-width="1.6" d="M44 64 h12 v40 h-12 Z"/>`,
    `<path fill="${t.body}" d="M45.5 72 h9 v30.5 h-9 Z"/><path fill="#FFFFFF" fill-opacity=".55" d="M46.5 73 h2 v28 h-2 Z"/>`,
    // tap: block, spout, red lever
    `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="${SW}" stroke-linejoin="round" d="M40 108 H60 V118 H55 V126 Q55 128 53 128 H47 Q45 128 45 126 V118 H40 Z"/>`,
    `<path fill="${GUN}" stroke="${INK_BG}" stroke-width="1.8" stroke-linejoin="round" d="M57 110 L70 98 Q73 96 74.5 99 Q75 101 73 103 L60 114 Z"/>`,
    `<path fill="${t.body}" stroke="${INK_BG}" stroke-width="1" d="M48 128 h4 l-.6 3.4 a1.4 1.4 0 0 1 -2.8 0 Z"/>`,
    // fast taps (tea2): a chrome double spout and a gold lightning badge on the tank
    fast ? `<path fill="${STEEL_HI}" stroke="${INK_BG}" stroke-width="1.6" stroke-linejoin="round" d="M26 108 H38 V120 H34 V126 H30 V120 H26 Z"/>` +
      `<path fill="${t.body}" d="M30.6 126 h2.8 l-.4 3 a1.1 1.1 0 0 1 -2 0 Z"/>` +
      `<path fill="${LEMON}" stroke="${INK_BG}" stroke-width="1.4" stroke-linejoin="round" d="M30 64 L24 80 H30 L27 94 L38 76 H32 L36 64 Z"/>` : '',
  ];
  return svg('as-station as-tank', '0 0 100 140', body.join(''), ` data-kind="${k}" data-fast="${fast ? 1 : 0}"`);
}

// Steel hotel pan in three-quarter view: back edge y 14, front edge y 46, front face y 46–62.
function panShell(innerBody, name, deep = false) {
  const front = deep ? 68 : 62;
  return [
    `<path fill="#1B1311" fill-opacity=".25" d="${ell(50, front + 4, 46, 4)}"/>`,
    `<path fill="${STEEL_LO}" stroke="${INK_BG}" stroke-width="${SW}" stroke-linejoin="round" d="M10 14 H90 L97 46 H3 Z"/>`,
    `<path fill="${celShade(STEEL_LO)}" d="M15 18 H85 L88 30 H12 Z"/>`,
    innerBody,
    // rim (lip) and front face
    `<path fill="none" stroke="${STEEL_HI}" stroke-width="3" stroke-linejoin="round" d="M11.5 15.6 H88.5 L95 44.6 H5 Z"/>`,
    `<path fill="none" stroke="${INK_BG}" stroke-width="1.2" stroke-linejoin="round" d="M14 18 H86 L92.4 43 H7.6 Z"/>`,
    steelBody(`M3 46 H97 L95 ${front} H5 Z`),
    `<path fill="${celShade(STEEL)}" d="M89 47.4 H95.6 L94 ${front - 1.2} H88.4 Z"/>`,
    `<path fill="${PAPER}" stroke="${INK_BG}" stroke-width="1.2" d="M30 ${front - 14.5} H70 V${front - 2} H30 Z"/>`,
    label(50, front - 4.6, name, 10),
  ].join('');
}

// Topping items scattered over the pan floor region (top edge yT .. front y 43), n items.
function trayItems(kind, n, yT, seed) {
  const rnd = mulberry32(seed);
  const items = [];
  const rows = Math.max(1, Math.round((43 - yT) / 7));
  const per = Math.ceil(n / rows);
  let left = n;
  for (let r = 0; r < rows && left > 0; r++) {
    const y = 43 - 4 - (r * (43 - yT - 7)) / Math.max(1, rows - 1 || 1);
    const xa = 8 + ((43 - y) / 32) * 6;
    const cnt = Math.min(per, left);
    for (let i = 0; i < cnt; i++) {
      const x = xa + 4 + ((100 - 2 * xa - 8) * (i + 0.5 + (r % 2) * 0.35)) / cnt;
      items.push([r1(x + (rnd() - 0.5) * 2), r1(y + (rnd() - 0.5) * 2), (rnd() - 0.5) * 40]);
    }
    left -= cnt;
  }
  if (kind === 'pearl') {
    return `<path fill="${PEARL}" stroke="${INK}" stroke-width=".6" d="${items.map(([x, y]) => ringPath(x, y, 3.4)).join(' ')}"/>` +
      `<path fill="#FFFFFF" fill-opacity=".75" d="${items.map(([x, y]) => ringPath(r1(x - 1.1), r1(y - 1.2), 0.9)).join(' ')}"/>`;
  }
  if (kind === 'coconut') {
    return `<path fill="${COCO}" fill-opacity=".92" stroke="#B9A673" stroke-width=".7" stroke-linejoin="round" d="${items.map(([x, y, a]) => sq(x, y, 5.4, a)).join(' ')}"/>` +
      `<path fill="#FFFFFF" fill-opacity=".85" d="${items.map(([x, y, a]) => sq(r1(x - 1), r1(y - 1), 1.8, a)).join(' ')}"/>`;
  }
  if (kind === 'pudding') {
    return `<path fill="${PUDDING}" stroke="#B8801E" stroke-width=".7" stroke-linejoin="round" d="${items.map(([x, y]) => `M${r1(x - 3.4)} ${r1(y + 2.6)} L${r1(x - 2.6)} ${r1(y - 2.4)} H${r1(x + 2.6)} L${r1(x + 3.4)} ${r1(y + 2.6)} Z`).join(' ')}"/>` +
      `<path fill="${CARAMEL}" d="${items.map(([x, y]) => `M${r1(x - 2.6)} ${r1(y - 2.4)} H${r1(x + 2.6)} L${r1(x + 2.8)} ${r1(y - 0.8)} H${r1(x - 2.8)} Z`).join(' ')}"/>`;
  }
  return `<path fill="${GRASS}" stroke="${INK}" stroke-width=".6" stroke-linejoin="round" d="${items.map(([x, y, a]) => sq(x, y, 5.8, a * 0.6)).join(' ')}"/>` +
    `<path fill="none" stroke="${GRASS_HI}" stroke-width="1.1" stroke-linecap="round" d="${items.map(([x, y]) => `M${r1(x - 2.2)} ${r1(y - 1)} l1.8 -1.4`).join(' ')}"/>`;
}

const TRAY_BASE = { pearl: '#4A2A1A', coconut: '#E9DDB0', pudding: '#E8AE45', grass: '#1E1F16' };

export function toppingTraySVG(kind = 'pearl', scoopsLeft = 10) {
  const k = TOPPING_KINDS.includes(kind) ? kind : 'pearl';
  const left = int(scoopsLeft, 0, 10, 10);
  const f = left / 10;
  let inner = '';
  if (left > 0) {
    const yT = r1(30 - f * 12); // the pile's back edge rises as the tray fills
    const xT = r1(12 - ((30 - yT) / 32) * 7 + 3);
    inner += `<path fill="${TRAY_BASE[k]}" d="M${xT} ${yT} H${r1(100 - xT)} L92 43 H8 Z"/>`;
    inner += trayItems(k, 6 + Math.round(f * 18), yT, fnv1a(k + left));
  } else {
    inner += `<path fill="none" stroke="${STEEL_HI}" stroke-width="1.4" stroke-opacity=".7" stroke-linecap="round" d="M22 36 L30 26 M30 38 L40 26"/>`;
  }
  // a long-handled scoop resting in the pan
  inner += `<path fill="none" stroke="${INK_BG}" stroke-width="4.2" stroke-linecap="round" d="M70 34 L86 4"/><path fill="none" stroke="${STEEL_HI}" stroke-width="2" stroke-linecap="round" d="M70 34 L86 4"/>` +
    `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="1.6" d="${ell(68, 37, 7, 4)}"/>`;
  return svg('as-station as-tray', '0 0 100 90', panShell(inner, TOPPING_NAME[k]), ` data-kind="${k}" data-left="${left}"`);
}

export function iceBinSVG() {
  const cubes = [];
  const rnd = mulberry32(250);
  for (let r = 0; r < 3; r++) {
    const y = 40 - r * 8.4;
    const xa = 10 + r * 2.4;
    for (let x = xa + 6; x < 100 - xa - 4; x += 10.4) cubes.push([r1(x + (r % 2) * 4 + (rnd() - 0.5) * 2), r1(y + (rnd() - 0.5) * 2), (rnd() - 0.5) * 50]);
  }
  const inner = `<path fill="#CFE7F4" d="M13 17 H87 L92 43 H8 Z"/>` +
    `<path fill="${ICE}" stroke="${ICE_EDGE}" stroke-width="1" stroke-linejoin="round" d="${cubes.map(([x, y, a]) => sq(x, y, 9, a)).join(' ')}"/>` +
    `<path fill="#FFFFFF" d="${cubes.map(([x, y, a]) => sq(r1(x - 1.8), r1(y - 1.8), 3, a)).join(' ')}"/>` +
    `<path fill="${celShade(ICE)}" fill-opacity=".6" d="${cubes.map(([x, y, a]) => `M${r1(x + 1)} ${r1(y + 4.4)} h3.4 v-3 Z`).join(' ')}"/>` +
    // ice scoop
    `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="1.6" stroke-linejoin="round" d="M58 30 L74 22 Q80 26 78 33 L64 38 Q58 36 58 30 Z"/>` +
    `<path fill="none" stroke="${INK_BG}" stroke-width="4" stroke-linecap="round" d="M77 26 L90 18"/><path fill="none" stroke="${COUNTER}" stroke-width="2.2" stroke-linecap="round" d="M77 26 L90 18"/>`;
  return svg('as-station as-ice', '0 0 100 90', panShell(inner, '冰塊', true));
}

export function syrupSVG() {
  const body = [
    `<path fill="#1B1311" fill-opacity=".25" d="${ell(35, 126, 24, 3.4)}"/>`,
    // pump head: nozzle, stem, cap
    `<path fill="${COUNTER}" stroke="${INK_BG}" stroke-width="${SW}" stroke-linejoin="round" d="M26 14 H44 V22 H26 Z M44 15 H58 Q61 15 61 18 V22 H57 V19 H44 Z"/>`,
    `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="1.6" d="M32 22 h6 v10 h-6 Z"/>`,
    `<path fill="${COUNTER}" stroke="${INK_BG}" stroke-width="${SW}" stroke-linejoin="round" d="M25 32 H45 L47 42 H23 Z"/>`,
    // bottle with amber syrup
    `<path fill="#FFF4DD" fill-opacity=".5" stroke="${INK_BG}" stroke-width="${SW}" stroke-linejoin="round" d="M22 42 H48 Q58 48 58 60 V118 Q58 124 52 124 H18 Q12 124 12 118 V60 Q12 48 22 42 Z"/>`,
    `<path fill="${SYRUP}" d="M14 58 H56 V118 Q56 122 52 122 H18 Q14 122 14 118 Z"/>`,
    `<path fill="${celShade(SYRUP)}" d="M47 58 H56 V118 Q56 122 52 122 H47 Z"/>`,
    `<path fill="${celHilite(SYRUP)}" d="${ell(35, 58, 21, 2.6)}"/>`,
    `<path fill="#FFFFFF" fill-opacity=".6" d="M17 52 h4 v62 h-4 Z"/>`,
    // label
    `<path fill="${PAPER}" stroke="${INK_BG}" stroke-width="1.4" d="M16 76 H54 V104 H16 Z"/>`,
    `<path fill="none" stroke="${TAKE_DEEP}" stroke-width="1.4" d="M18 79 H52 M18 101 H52"/>`,
    label(35, 96, '果糖', 15),
    `<path fill="${SYRUP}" d="M58 22 h3 v2 a1.5 2 0 0 1 -3 0 Z"/>`,
  ];
  return svg('as-station as-syrup', '0 0 70 130', body.join(''));
}

export function sealerSVG(state = 'idle', { turbo = false } = {}) {
  const busy = state === 'busy';
  const dy = busy ? 16 : 0;
  const body = [
    `<path fill="#1B1311" fill-opacity=".25" d="${ell(55, 146, 50, 4)}"/>`,
    // base plate + cup ring
    steelBody('M8 132 H102 L104 144 H6 Z'),
    `<path fill="${celShade(STEEL)}" d="M86 133.4 H101 L102.4 142.6 H86 Z"/>`,
    `<path fill="${STEEL_LO}" stroke="${INK_BG}" stroke-width="1.6" d="${ell(55, 134, 26, 4)}"/>`,
    // column at the back
    `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="${SW}" d="M80 50 H96 V134 H80 Z"/><path fill="${STEEL_HI}" d="M82.5 52 h3 v80 h-3 Z"/>`,
    // film roll on top: printed red/white
    `<path fill="${PAPER}" stroke="${INK_BG}" stroke-width="${SW}" d="M22 6 H78 Q84 6 84 13 Q84 20 78 20 H22 Z"/>`,
    `<path fill="none" stroke="${GUN}" stroke-width="2.4" stroke-dasharray="3 5" d="M26 13 H78"/>`,
    `<path fill="${PAPER_SH}" stroke="${INK_BG}" stroke-width="${SW}" d="${ell(22, 13, 4.2, 7)}"/>`,
    // red housing with a silver panel
    `<path fill="${GUN}" stroke="${INK_BG}" stroke-width="${SW}" stroke-linejoin="round" d="M14 24 Q14 20 18 20 H92 Q98 20 98 26 V60 Q98 64 94 64 H18 Q14 64 14 60 Z"/>`,
    `<path fill="${GUN_DEEP}" d="M14 52 H98 V60 Q98 62.8 94 62.8 H18 Q15.2 62.8 15.2 60 Z"/>`,
    `<path fill="${STEEL_HI}" stroke="${INK_BG}" stroke-width="1.4" d="M22 28 H62 V46 H22 Z"/>`,
    `<text x="42" y="42" ${FONT_NUM} font-size="13" text-anchor="middle" fill="${GUN}">250</text>`,
    `<path fill="${busy ? TAKE : MINT}" stroke="${INK_BG}" stroke-width="1.2" d="${ringPath(74, 36, 4)}"/>`,
    // film strip down to the head
    `<path fill="none" stroke="${PAPER}" stroke-width="3" stroke-opacity=".85" d="M30 20 V24"/>`,
    // press head (moves down when busy) + lever
    `<g class="as-sealer-head" transform="translate(0 ${dy})">` +
      `<path fill="${STEEL_LO}" stroke="${INK_BG}" stroke-width="1.6" d="M48 64 h14 v16 h-14 Z"/>` +
      `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="${SW}" stroke-linejoin="round" d="M26 80 H84 L80 90 H30 Z"/>` +
      (busy ? `<path fill="${TAKE}" fill-opacity=".35" d="${ell(55, 92, 30, 5)}"/><path fill="${GOLD_HI}" fill-opacity=".8" d="${ell(55, 91, 22, 2.4)}"/>` : '') +
    `</g>`,
    `<g class="as-sealer-lever" transform="rotate(${busy ? 24 : 0} 96 42)"><path fill="none" stroke="${INK_BG}" stroke-width="5" stroke-linecap="round" d="M96 42 L108 14"/><path fill="none" stroke="${STEEL_HI}" stroke-width="2.6" stroke-linecap="round" d="M96 42 L108 14"/><path fill="${GUN}" stroke="${INK_BG}" stroke-width="1.6" d="${ringPath(108, 12, 5.4)}"/></g>`,
    // fast sealer (seal2): a gold racing stripe and a lightning badge on the housing
    turbo ? `<path fill="${LEMON}" stroke="${INK_BG}" stroke-width="1.2" d="M14 48 H98 V53 H14 Z"/><path fill="${LEMON}" stroke="${INK_BG}" stroke-width="1.4" stroke-linejoin="round" d="M68 24 L62 38 H68 L65 50 L76 34 H70 L74 24 Z"/>` : '',
  ];
  return svg('as-station as-sealer', '0 0 110 150', body.join(''), ` data-state="${busy ? 'busy' : 'idle'}" data-turbo="${turbo ? 1 : 0}"`);
}

export function potSVG(opts = {}) {
  const scoops = int(opts.scoops, 0, 10, 0);
  const pct = clamp(Number(opts.cookingPct ?? 1) || 0, 0, 1);
  const cooking = pct < 1;
  const parts = [`<path fill="#1B1311" fill-opacity=".25" d="${ell(55, 104, 46, 4)}"/>`];
  // handles
  parts.push(`<path fill="none" stroke="${INK_BG}" stroke-width="6" stroke-linecap="round" d="M10 50 H3 M100 50 H107"/><path fill="none" stroke="${COUNTER}" stroke-width="3.4" stroke-linecap="round" d="M10 50 H3 M100 50 H107"/>`);
  // body
  parts.push(steelBody('M12 42 H98 V92 Q98 100 90 100 H20 Q12 100 12 92 Z'));
  parts.push(`<path fill="${celShade(STEEL)}" d="M80 44 H96.8 V92 Q96.8 98.8 90 98.8 H80 Z"/><path fill="${STEEL_HI}" d="M18 46 h5 v48 h-5 Z"/>`);
  // opening + contents
  parts.push(`<path fill="${STEEL_LO}" stroke="${INK_BG}" stroke-width="${SW}" d="${ell(55, 42, 43, 11)}"/>`);
  const n = cooking ? 14 : Math.round(scoops * 2.4);
  if (cooking || scoops > 0) {
    parts.push(`<path fill="${cooking ? '#8C6A4E' : '#7A4424'}" d="${ell(55, 43, 39, 8.6)}"/>`);
    const rnd = mulberry32(fnv1a(`pot${scoops}${cooking}`));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd());
      pts.push([r1(55 + Math.cos(a) * rr * 32), r1(43.5 + Math.sin(a) * rr * 6)]);
    }
    if (pts.length) {
      parts.push(`<path fill="${cooking ? '#C9A27E' : PEARL}" stroke="${cooking ? '#6B4A30' : INK}" stroke-width=".6" d="${pts.map(([x, y]) => ringPath(x, y, 3.6)).join(' ')}"/>`);
      parts.push(`<path fill="#FFFFFF" fill-opacity="${cooking ? 0.4 : 0.8}" d="${pts.map(([x, y]) => ringPath(r1(x - 1), r1(y - 1.1), 0.9)).join(' ')}"/>`);
    }
    if (cooking) {
      parts.push(`<path fill="none" stroke="#F3E2CC" stroke-width="1.2" d="${ringPath(36, 41, 2.4)} ${ringPath(70, 45, 3)} ${ringPath(58, 40, 1.8)} ${ringPath(46, 46, 1.6)}"/>`);
    }
  }
  parts.push(`<path fill="none" stroke="${STEEL_HI}" stroke-width="2" stroke-linecap="round" d="M20 38 Q34 32.4 50 31.6"/>`);
  if (cooking) {
    // steam + ring timer
    parts.push(`<path class="as-pot-steam" fill="none" stroke="${PAPER}" stroke-width="3" stroke-linecap="round" stroke-opacity=".8" d="M38 30 q-5 -7 0 -14 q5 -7 0 -14 M58 28 q-5 -7 0 -14 q5 -7 0 -14 M74 30 q-4 -6 0 -11"/>`);
    parts.push(`<circle cx="92" cy="14" r="11" fill="${NIGHT_700}" stroke="${INK_BG}" stroke-width="1.6"/>`);
    parts.push(`<circle class="as-pot-timer" cx="92" cy="14" r="7.6" fill="none" stroke="${TAKE}" stroke-width="3.4" pathLength="100" stroke-dasharray="${r1(pct * 100)} 100" transform="rotate(-90 92 14)"/>`);
  }
  return svg('as-station as-pot', '0 0 110 110', parts.join(''), ` data-scoops="${scoops}" data-cooking="${cooking ? 1 : 0}"`);
}

export function cupRackSVG() {
  // three stacks of nested clear cups on a steel rack
  const stacks = [[22, 30], [50, 22], [78, 34]];
  let fill = '';
  let rims = '';
  let outline = '';
  let glint = '';
  for (const [cx, top] of stacks) {
    const hw = 13;
    fill += `M${cx - hw} ${top} L${cx - 9} 96 H${cx + 9} L${cx + hw} ${top} Z `;
    outline += `M${cx - hw} ${top} L${cx - 9} 96 H${cx + 9} L${cx + hw} ${top} `;
    for (let y = top; y < top + 30; y += 5) rims += `M${cx - hw - 0.6} ${y} Q${cx} ${y + 3} ${cx + hw + 0.6} ${y} `;
    glint += `M${cx - 9} ${top + 32} L${cx - 7} 92 L${cx - 5} 92 L${cx - 6.4} ${top + 32} Z `;
  }
  const body = [
    `<path fill="#1B1311" fill-opacity=".25" d="${ell(50, 104, 46, 4)}"/>`,
    `<path fill="#DDEFF7" fill-opacity=".38" d="${fill}"/>`,
    `<path fill="none" stroke="#9FC4D8" stroke-width="1.2" d="${rims}"/>`,
    `<path fill="#FFFFFF" fill-opacity=".6" d="${glint}"/>`,
    `<path fill="none" stroke="${INK_BG}" stroke-width="1.8" stroke-linejoin="round" d="${outline}"/>`,
    `<path fill="none" stroke="${INK_BG}" stroke-width="1.8" d="${stacks.map(([cx, top]) => ell(cx, top, 13, 2.6)).join(' ')}"/>`,
    steelBody('M4 96 H96 L94 104 H6 Z'),
    `<path fill="${celShade(STEEL)}" d="M80 97.4 H94.4 L93 102.8 H80 Z"/>`,
  ];
  return svg('as-station as-rack', '0 0 100 110', body.join(''));
}

export function trashSVG() {
  const body = [
    `<path fill="#1B1311" fill-opacity=".25" d="${ell(40, 106, 32, 3.6)}"/>`,
    steelBody('M14 30 H66 L62 102 H18 Z'),
    `<path fill="${celShade(STEEL)}" d="M52 31.4 H64.6 L60.6 100.8 H50 Z"/>`,
    `<path fill="${STEEL_HI}" d="M20 34 h4 l-1 62 h-3 Z"/>`,
    `<path fill="none" stroke="${INK_BG}" stroke-width="1.2" stroke-opacity=".5" d="M32 40 L31 94 M42 40 V94"/>`,
    `<path fill="${GUN}" stroke="${INK_BG}" stroke-width="1.4" d="M15.4 50 H64.6 L64 58 H16 Z"/>`,
    // lid ajar, a crumpled cup peeking out
    `<path fill="#DDEFF7" stroke="${INK_BG}" stroke-width="1.4" stroke-linejoin="round" d="M44 28 L50 14 L60 16 L58 29 Z"/>`,
    `<g transform="rotate(-14 14 28)"><path fill="${NIGHT_700}" stroke="${INK_BG}" stroke-width="${SW}" stroke-linejoin="round" d="M10 22 Q10 18 14 18 H66 Q70 18 70 22 V28 H10 Z"/><path fill="${STEEL_LO}" stroke="${INK_BG}" stroke-width="1.6" d="M34 18 V14 H46 V18"/></g>`,
    // pedal
    `<path fill="${COUNTER_LO}" stroke="${INK_BG}" stroke-width="1.6" stroke-linejoin="round" d="M30 100 H50 L52 106 H28 Z"/>`,
  ];
  return svg('as-station as-trash', '0 0 80 110', body.join(''));
}

export function workSlotSVG() {
  const holes = [];
  for (let r = 0; r < 3; r++) {
    const y = 16 + r * 8;
    const xa = 22 - r * 3;
    holes.push(`M${xa} ${y} H${100 - xa}`);
  }
  const ribs = [];
  for (let x = 24; x <= 76; x += 8) ribs.push(`M${x} 13 L${r1(50 + (x - 50) * 1.18)} 38`);
  const body = [
    `<path fill="#1B1311" fill-opacity=".3" d="M6 42 H94 L96 46 H4 Z"/>`,
    steelBody('M14 8 H86 L96 42 H4 Z'),
    `<path fill="${celShade(STEEL)}" d="M84 9.4 L94 40.6 H84 Z"/>`,
    `<path fill="${COUNTER_LO}" d="M19 12 H81 L88 38 H12 Z"/>`,
    `<path fill="none" stroke="#3E3560" stroke-width="2" d="${holes.join(' ')} ${ribs.join(' ')}"/>`,
    `<path fill="none" stroke="${STEEL_HI}" stroke-width="1.8" stroke-linecap="round" d="M16 10 H84"/>`,
    steelBody('M4 42 H96 V47 H4 Z'),
  ];
  return svg('as-station as-slot', '0 0 100 50', body.join(''));
}

// ─── Order bubble (icons only) ──────────────────────────────────────────────────────────────────
function toppingIcon(kind, x, y) {
  if (kind === 'pearl') return { a: `${ringPath(x, y, 5.4)} `, fill: PEARL, glint: ringPath(r1(x - 1.8), r1(y - 1.8), 1.5) };
  if (kind === 'coconut') return { a: sq(x, y, 9.6, -10), fill: COCO, glint: sq(r1(x - 1.8), r1(y - 1.8), 3, -10) };
  if (kind === 'pudding') return { a: `M${x - 5.6} ${y + 5} L${x - 4.4} ${y - 4.6} H${x + 4.4} L${x + 5.6} ${y + 5} Z`, fill: PUDDING, glint: `M${x - 4.4} ${y - 4.6} H${x + 4.4} L${x + 4.8} ${y - 1.6} H${x - 4.8} Z` };
  return { a: sq(x, y, 9.6, 8), fill: GRASS, glint: `M${r1(x - 3.4)} ${r1(y - 1.4)} l2.8 -2.2` };
}

export function orderBubbleSVG(order = {}) {
  const c = normCup(order);
  const count = int(order.count, 1, 99, 1);
  const tea = c.tea ? TEA_COLORS[c.tea] : null;
  const parts = [];
  // bubble + tail (paper, ink outline, hard shadow below)
  const shape = 'M20 4 H100 Q116 4 116 20 V64 Q116 80 100 80 H36 L22 98 L24 80 H20 Q4 80 4 64 V20 Q4 4 20 4 Z';
  parts.push(`<path fill="${PAPER_SH}" d="${shape}" transform="translate(0 3)"/>`);
  parts.push(`<path fill="${PAPER}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" d="${shape}"/>`);
  // mini cup
  const cupD = 'M12 20 H40 L36 72 H16 Z';
  parts.push(`<path fill="#DDEFF7" d="${cupD}"/>`);
  if (tea) {
    parts.push(`<path fill="${tea.body}" d="M13.3 30 H38.7 L36 72 H16 Z"/><path fill="${celShade(tea.body)}" d="M32 30 H38.7 L36 72 H31 Z"/>`);
    if (c.tea === 'jade') parts.push(`<path fill="${LEMON}" stroke="#E2A800" stroke-width="1.2" d="${ringPath(21, 40, 4.6)}"/>`);
  }
  const tops = c.toppings;
  if (tops.length) {
    const d = tops.map((k, i) => {
      const y = 68 - i * 5.4;
      return [ringPath(19.5, y, 2.4), ringPath(26, y - 0.6, 2.4), ringPath(32.5, y, 2.4)].join(' ');
    });
    tops.forEach((k, i) => parts.push(`<path fill="${toppingIcon(k, 0, 0).fill}" stroke="${INK}" stroke-width=".6" d="${d[i]}"/>`));
  }
  parts.push(`<path fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" d="${cupD} M10 20 H42"/><path fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" d="M30 20 L35 9"/>`);
  // rows on the right: toppings, ice ×n, sugar ×n
  const rows = [];
  if (tops.length) rows.push('t');
  if (c.ice) rows.push('i');
  if (c.sugar) rows.push('s');
  const gap = rows.length ? 66 / rows.length : 0;
  rows.forEach((row, ri) => {
    const y = r1(9 + gap * (ri + 0.5));
    if (row === 't') {
      const icons = tops.map((k, i) => toppingIcon(k, 58 + i * 17, y));
      icons.forEach((ic) => parts.push(`<path fill="${ic.fill}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round" d="${ic.a}"/>`));
      const gl = icons.map((ic, i) => ({ d: ic.glint, k: tops[i] }));
      const caramel = gl.filter((g) => g.k === 'pudding').map((g) => g.d).join(' ');
      const white = gl.filter((g) => g.k === 'pearl' || g.k === 'coconut').map((g) => g.d).join(' ');
      const grass = gl.filter((g) => g.k === 'grass').map((g) => g.d).join(' ');
      if (white) parts.push(`<path fill="#FFFFFF" fill-opacity=".85" d="${white}"/>`);
      if (caramel) parts.push(`<path fill="${CARAMEL}" d="${caramel}"/>`);
      if (grass) parts.push(`<path fill="none" stroke="${GRASS_HI}" stroke-width="1.4" stroke-linecap="round" d="${grass}"/>`);
    } else if (row === 'i') {
      const d = Array.from({ length: c.ice }, (_, i) => sq(58 + i * 17, y, 11, i ? 10 : -8)).join(' ');
      const g = Array.from({ length: c.ice }, (_, i) => sq(r1(56 + i * 17), r1(y - 2), 3.4, i ? 10 : -8)).join(' ');
      parts.push(`<path fill="${ICE}" stroke="${ICE_EDGE}" stroke-width="1.6" stroke-linejoin="round" d="${d}"/><path fill="#FFFFFF" d="${g}"/>`);
    } else {
      // a syrup drop per sugar level
      const d = Array.from({ length: c.sugar }, (_, i) => { const x = 58 + i * 17; return `M${x} ${r1(y - 7)} Q${x + 6} ${r1(y + 0.4)} ${x + 5} ${r1(y + 2.6)} A5.2 5.2 0 0 1 ${x - 5} ${r1(y + 2.6)} Q${x - 6} ${r1(y + 0.4)} ${x} ${r1(y - 7)} Z`; }).join(' ');
      parts.push(`<path fill="${SYRUP}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round" d="${d}"/>` +
        `<path fill="#FFFFFF" fill-opacity=".7" d="${Array.from({ length: c.sugar }, (_, i) => ringPath(r1(56 + i * 17), r1(y + 1.6), 1.4)).join(' ')}"/>`);
    }
  });
  if (count > 1) {
    parts.push(`<path fill="${GUN}" stroke="${INK}" stroke-width="2.2" d="${ringPath(110, 8, 12)}"/>`);
    parts.push(`<text x="110" y="13" ${FONT_NUM} font-size="14" text-anchor="middle" fill="${PAPER}">×${count}</text>`);
  }
  return svg('as-bubble', '0 0 120 100', parts.join(''), ` data-count="${count}"`);
}

// ─── Coin, patience ring ───────────────────────────────────────────────────────────────────────
export function coinSVG() {
  const body = [
    `<path fill="${TAKE_DEEP}" d="${ringPath(20, 21.6, 17)}"/>`,
    `<path fill="${TAKE}" stroke="#A85F00" stroke-width="2" d="${ringPath(20, 20, 17)}"/>`,
    `<path fill="none" stroke="${TAKE_DEEP}" stroke-width="1.4" d="${ringPath(20, 20, 13)}"/>`,
    `<text x="20" y="24.4" ${FONT_NUM} font-size="11" text-anchor="middle" fill="#A85F00">NT$</text>`,
    `<path fill="none" stroke="${GOLD_HI}" stroke-width="2.2" stroke-linecap="round" d="M8.6 15 Q11 8.6 18 7"/>`,
  ];
  return svg('as-coin', '0 0 40 40', body.join(''));
}

// green (full) → yellow (half) → red (empty)
function patienceColor(p) {
  return p >= 0.5 ? mixColor(MINT, TAKE, (p - 0.5) * 2) : mixColor(TAKE, GUN, p * 2);
}
export function patienceRingSVG(pct = 1) {
  const p = clamp(Number(pct) || 0, 0, 1);
  const col = patienceColor(p);
  const body = [
    `<circle cx="20" cy="20" r="16" fill="${NIGHT_700}" fill-opacity=".55" stroke="${COUNTER_LO}" stroke-width="5"/>`,
    `<circle class="as-pr-arc" cx="20" cy="20" r="16" fill="none" stroke="${col}" stroke-width="4.2" stroke-linecap="round" pathLength="100" stroke-dasharray="${r1(p * 100)} 100" transform="rotate(-90 20 20)"/>`,
  ];
  return svg('as-patience', '0 0 40 40', body.join(''), ` data-pct="${r1(p)}"`);
}

// ─── Work-area backdrop ────────────────────────────────────────────────────────────────────────
export function counterBackdropSVG() {
  // backsplash tiles 24×16 (subway pattern) over y 0–150
  let grout = '';
  for (let y = 16; y < 150; y += 16) grout += `M-120 ${y} H480 `;
  for (let r = 0; r < 10; r++) {
    const off = r % 2 ? 12 : 0;
    for (let x = -120 + off; x < 480; x += 24) grout += `M${x} ${r * 16} v16 `;
  }
  let seams = '';
  for (let x = -120; x <= 480; x += 90) seams += `M${x} 172 V420 `;
  const handles = [];
  for (let x = -75; x <= 435; x += 90) handles.push(`M${x - 10} 190 h20`);
  const body = [
    `<defs>`,
    `<radialGradient id="asBdWall" gradientUnits="userSpaceOnUse" cx="180" cy="30" r="260"><stop offset="0" stop-color="#FBEBD0"/><stop offset=".6" stop-color="#EDCB9A"/><stop offset="1" stop-color="#B98456"/></radialGradient>`,
    `<linearGradient id="asBdFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${STEEL}"/><stop offset="1" stop-color="${mixColor(STEEL_LO, COUNTER, 0.6)}"/></linearGradient>`,
    `</defs>`,
    `<rect x="-120" y="-200" width="600" height="352" fill="url(#asBdWall)"/>`,
    `<path fill="none" stroke="#C9A372" stroke-width="1.1" stroke-opacity=".7" d="${grout}"/>`,
    // tile glints (warm light from the upper left)
    `<path fill="#FFF6E2" fill-opacity=".55" d="M60 20 h10 v2 h-10 Z M132 36 h10 v2 h-10 Z M84 68 h10 v2 h-10 Z M204 20 h10 v2 h-10 Z M36 100 h10 v2 h-10 Z M228 84 h10 v2 h-10 Z"/>`,
    // under-shelf warm light strip
    `<rect x="-120" y="-14" width="600" height="10" fill="${mixColor(STEEL_LO, INK_BG, 0.5)}"/>`,
    `<rect x="-120" y="-4" width="600" height="3" fill="${WARM_RIM}"/>`,
    // steel utensil rail
    `<path fill="none" stroke="${INK_BG}" stroke-width="4" stroke-linecap="round" d="M20 40 H340"/><path fill="none" stroke="${STEEL_HI}" stroke-width="1.6" stroke-linecap="round" d="M20 39.4 H340"/>`,
    // back counter top (steel) with highlight and shadow line
    `<rect x="-120" y="150" width="600" height="16" fill="${STEEL}" stroke="${INK_BG}" stroke-width="1.6"/>`,
    `<path fill="none" stroke="#FFFFFF" stroke-width="2" stroke-opacity=".9" d="M-120 152.4 H480"/>`,
    `<rect x="-120" y="140" width="600" height="10" fill="${INK_BG}" fill-opacity=".14"/>`,
    // steel cabinet fronts below
    `<rect x="-120" y="166" width="600" height="260" fill="url(#asBdFront)"/>`,
    `<rect x="-120" y="166" width="600" height="6" fill="#1B1311" fill-opacity=".3"/>`,
    `<path fill="none" stroke="${INK_BG}" stroke-width="1.4" stroke-opacity=".55" d="${seams}"/>`,
    `<path fill="none" stroke="${STEEL_HI}" stroke-width="1.2" stroke-opacity=".5" d="${seams.replace(/M(-?\d+) /g, (m, x) => `M${Number(x) + 2} `)}"/>`,
    `<path fill="none" stroke="${INK_BG}" stroke-width="4" stroke-linecap="round" d="${handles.join(' ')}"/><path fill="none" stroke="${STEEL_HI}" stroke-width="1.6" stroke-linecap="round" d="${handles.join(' ')}"/>`,
  ];
  return `<svg class="as-backdrop" viewBox="0 0 360 300" preserveAspectRatio="xMidYMid slice" overflow="visible" aria-hidden="true">${body.join('')}</svg>`;
}

// ─── Landscape work table (docs/gameplay-v3-shop.md 10.1, 10.4, 10.7) ─────────────────────────────
//   tableSVG()                          <svg class="as-table">, viewBox 0 0 1280 378: the steel work table seen from the clerk
//                                       (back row, a step, front row, a ribbed mat under the work slots)
//   shelfSVG(n, { autoSeal })           <svg class="as-shelf" data-n>, viewBox 0 0 232 196: the two-tier finished-cup shelf
//                                       (出杯台, n = 4..6 spots, layout.stations order); autoSeal (seal4) adds the sealing gantry
//   itemsBubbleSVG(order, got)          <svg class="as-bubble as-items" data-count>: one mini cup per item of a multi-cup
//                                       order ({ items, big }), a tick on each delivered one; one item = orderBubbleSVG, the
//                                       golden recipe = a gold cup
//   teaManifoldSVG(n)                   <svg class="as-manifold">, viewBox 0 0 264 40: the tea3 pipe over n tanks
//   iceDispenserSVG()                   <svg class="as-station as-ice as-dispenser">, viewBox 0 0 100 90 (ice2)
//   potRigSVG(lv)                       <svg class="as-pot-rig" data-lv>, viewBox 0 0 110 110: burner flames (Lv3+) and the
//                                       refill hopper (Lv4), drawn behind the pot
//   goldenCardSVG()                     <svg class="as-golden-card">, viewBox 0 0 70 60: the 黃金比例 picture card (menu3)
export function tableSVG() {
  let ribs = '';
  for (let x = 396; x < 874; x += 12) ribs += `M${x} 16 V194 `;
  let brush = '';
  for (let y = 222; y < 366; y += 9) brush += `M0 ${y} H1280 `;
  const body = [
    `<defs><linearGradient id="asTbBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8C94A3"/><stop offset="1" stop-color="#A7AFBC"/></linearGradient>` +
      `<linearGradient id="asTbFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9D0DA"/><stop offset="1" stop-color="#A3AAB7"/></linearGradient></defs>`,
    `<rect x="0" y="0" width="1280" height="210" fill="url(#asTbBack)"/>`,
    `<rect x="0" y="0" width="1280" height="10" fill="#1B1311" fill-opacity=".28"/>`,
    `<path fill="${COUNTER_LO}" fill-opacity=".85" d="M386 12 H880 V198 H386 Z"/>`,
    `<path fill="none" stroke="#3E3560" stroke-width="3" d="${ribs}"/>`,
    `<rect x="0" y="206" width="1280" height="172" fill="url(#asTbFront)"/>`,
    `<path fill="none" stroke="#FFFFFF" stroke-opacity=".18" stroke-width="1.2" d="${brush}"/>`,
    `<path fill="none" stroke="${STEEL_HI}" stroke-width="3" d="M0 207.5 H1280"/><rect x="0" y="198" width="1280" height="8" fill="${STEEL_LO}"/>`,
    `<rect x="0" y="366" width="1280" height="12" fill="${mixColor(STEEL_LO, COUNTER, 0.5)}"/>`,
  ];
  return `<svg class="as-table" viewBox="0 0 1280 378" preserveAspectRatio="none" aria-hidden="true">${body.join('')}</svg>`;
}

export function shelfSVG(n = 4, { autoSeal = false } = {}) {
  const k = int(n, 1, 6, 4);
  const cols = Math.ceil(k / 2);
  const cw = 232 / cols;
  let rings = '';
  for (let i = 0; i < k; i++) {
    const row = i < cols ? 0 : 1;
    const col = row ? i - cols : i;
    const off = row && k % 2 ? cw / 2 : 0;
    rings += ell(r1(col * cw + off + cw / 2), row ? 186 : 88, r1(cw * 0.3), 4) + ' ';
  }
  const body = [
    `<path fill="#1B1311" fill-opacity=".25" d="M2 192 H230 L232 198 H0 Z"/>`,
    // back panel + posts
    `<path fill="${mixColor(STEEL_LO, COUNTER, 0.7)}" d="M6 0 H226 V190 H6 Z"/>`,
    `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="${SW}" d="M0 0 H8 V196 H0 Z M224 0 H232 V196 H224 Z"/>`,
    // two tier boards
    steelBody('M0 90 H232 V100 H0 Z'), steelBody('M0 188 H232 V196 H0 Z'),
    `<path fill="none" stroke="${STEEL_HI}" stroke-width="2" d="M2 91.5 H230 M2 189.5 H230"/>`,
    `<path fill="none" stroke="${STEEL_HI}" stroke-opacity=".5" stroke-width="1.6" d="${rings}"/>`,
    autoSeal ? `<g class="as-gantry"><path fill="${GUN}" stroke="${INK_BG}" stroke-width="${SW}" stroke-linejoin="round" d="M-4 -18 H236 V-4 H-4 Z"/>` +
      `<path fill="${LEMON}" stroke="${INK_BG}" stroke-width="1.4" d="M8 -14 H224 V-9 H8 Z"/>` +
      `<g class="as-gantry-head"><path fill="${STEEL}" stroke="${INK_BG}" stroke-width="1.8" d="M96 -4 H136 V8 H96 Z"/><path fill="${PAPER}" stroke="${INK_BG}" stroke-width="1.4" d="M104 8 H128 V12 H104 Z"/></g></g>` : '',
  ];
  return svg('as-shelf', '0 0 232 196', body.join(''), ` data-n="${k}" data-auto="${autoSeal ? 1 : 0}"`);
}

function miniCard(it, x, y, done) {
  const c = normCup(it);
  const golden = !!(it && it.golden);
  const tea = c.tea ? TEA_COLORS[c.tea] : null;
  const p = [];
  p.push(`<path fill="#DDEFF7" d="M${x + 3} ${y + 6} H${x + 27} L${x + 24} ${y + 52} H${x + 6} Z"/>`);
  if (golden) {
    p.push(`<path fill="${TAKE}" d="M${x + 3.7} ${y + 14} H${x + 26.3} L${x + 24} ${y + 52} H${x + 6} Z"/><path fill="${GOLD_HI}" d="M${x + 6} ${y + 18} h4 l-1 30 h-3 Z"/>`);
    p.push(`<path fill="${GOLD_HI}" stroke="${TAKE_DEEP}" stroke-width="1" d="M${x + 38} ${y + 8} l2.4 6 6 2.4 -6 2.4 -2.4 6 -2.4 -6 -6 -2.4 6 -2.4 Z M${x + 40} ${y + 32} l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z"/>`);
  } else if (tea) {
    p.push(`<path fill="${tea.body}" d="M${x + 3.7} ${y + 16} H${x + 26.3} L${x + 24} ${y + 52} H${x + 6} Z"/><path fill="${celShade(tea.body)}" d="M${x + 21} ${y + 16} H${x + 26.3} L${x + 24} ${y + 52} H${x + 20} Z"/>`);
    if (c.tea === 'jade') p.push(`<path fill="${LEMON}" stroke="#E2A800" stroke-width="1" d="${ringPath(x + 10, y + 22, 3.2)}"/>`);
  }
  if (!golden) {
    c.toppings.forEach((k, i) => {
      const cx = x + 15;
      const cy = y + 45 - i * 9;
      const ic = toppingIcon(k, 0, 0);
      p.push(`<path fill="${ic.fill}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round" transform="translate(${r1(cx)} ${r1(cy)}) scale(.78)" d="${ic.a}"/>`);
    });
    for (let i = 0; i < c.ice; i++) p.push(`<path fill="${ICE}" stroke="${ICE_EDGE}" stroke-width="1.4" stroke-linejoin="round" d="${sq(x + 39, y + 11 + i * 11, 9, i ? 10 : -8)}"/>`);
    for (let i = 0; i < c.sugar; i++) {
      const sx = x + 39;
      const sy = y + 36 + i * 11;
      p.push(`<path fill="${SYRUP}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round" d="M${sx} ${sy - 6} Q${sx + 5} ${sy} ${sx + 4} ${sy + 2} A4.4 4.4 0 0 1 ${sx - 4} ${sy + 2} Q${sx - 5} ${sy} ${sx} ${sy - 6} Z"/>`);
    }
  }
  p.push(`<path fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round" d="M${x + 3} ${y + 6} L${x + 6} ${y + 52} H${x + 24} L${x + 27} ${y + 6} M${x + 1} ${y + 6} H${x + 29} M${x + 19} ${y + 6} L${x + 23} ${y - 2}"/>`);
  if (done) {
    p.push(`<path fill="${PAPER}" fill-opacity=".62" d="M${x} ${y - 4} H${x + 50} V${y + 58} H${x} Z"/>`);
    p.push(`<path fill="${MINT}" stroke="${INK}" stroke-width="2" d="${ringPath(x + 36, y + 42, 10)}"/><path fill="none" stroke="${PAPER}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" d="M${x + 31} ${y + 42} L${x + 35} ${y + 46} L${x + 42} ${y + 37}"/>`);
  }
  return `<g class="as-item${done ? ' done' : ''}">${p.join('')}</g>`;
}

export function itemsBubbleSVG(order = {}, got = []) {
  const items = Array.isArray(order.items) ? order.items : [order];
  const n = items.length;
  if (n === 1 && !items[0].golden) return orderBubbleSVG({ ...items[0], count: 1 });
  const cols = n === 1 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const W = 16 + cols * 50 + (cols - 1) * 4;
  const H = 16 + rows * 58 + (rows - 1) * 4;
  const shape = `M12 2 H${W - 12} Q${W - 2} 2 ${W - 2} 12 V${H - 12} Q${W - 2} ${H - 2} ${W - 12} ${H - 2} H34 L16 ${H + 14} L20 ${H - 2} H12 Q2 ${H - 2} 2 ${H - 12} V12 Q2 2 12 2 Z`;
  const parts = [
    `<path fill="${PAPER_SH}" d="${shape}" transform="translate(0 3)"/>`,
    `<path fill="${n === 1 ? LEMON : PAPER}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" d="${shape}"/>`,
  ];
  items.forEach((it, i) => parts.push(miniCard(it, 8 + (i % cols) * 54, 10 + Math.floor(i / cols) * 62, !!got[i])));
  if (order.big) {
    // a big order: a paper carry bag on the corner
    parts.push(`<path fill="#C99A62" stroke="${INK}" stroke-width="2" stroke-linejoin="round" d="M${W - 18} -6 H${W + 6} L${W + 8} 20 H${W - 20} Z"/><path fill="none" stroke="${INK}" stroke-width="2" d="M${W - 12} -6 Q${W - 6} -18 ${W} -6"/>`);
  }
  return svg('as-bubble as-items', `0 0 ${W} ${H + 16}`, parts.join(''), ` data-count="${n}" data-got="${got.filter(Boolean).length}"`);
}

export function teaManifoldSVG(n = 3) {
  const k = int(n, 1, 3, 3);
  const w = 264 / k;
  let drops = '';
  for (let i = 0; i < k; i++) drops += `M${r1(w * (i + 0.5) - 5)} 24 h10 v14 h-10 Z `;
  return svg('as-manifold', '0 0 264 40', `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="${SW}" d="M4 14 H260 V26 H4 Z ${drops}"/>` +
    `<path fill="none" stroke="${STEEL_HI}" stroke-width="2" d="M6 16.5 H258"/>` +
    `<path fill="${GUN}" stroke="${INK_BG}" stroke-width="1.8" d="${ringPath(18, 8, 7)}"/><path fill="none" stroke="${INK_BG}" stroke-width="2" d="M18 15 V20"/>`);
}

export function iceDispenserSVG() {
  const body = [
    `<path fill="#1B1311" fill-opacity=".25" d="${ell(50, 86, 44, 4)}"/>`,
    steelBody('M8 4 Q8 0 12 0 H88 Q92 0 92 4 V82 H8 Z'),
    `<path fill="${celShade(STEEL)}" d="M76 1.4 H88 Q90.6 1.4 90.6 4 V80.6 H76 Z"/>`,
    `<path fill="#CFE7F4" stroke="${INK_BG}" stroke-width="1.8" d="M16 8 H70 V40 H16 Z"/>`,
    `<path fill="${ICE}" stroke="${ICE_EDGE}" stroke-width="1" d="${[[24, 30], [34, 26], [46, 31], [58, 27], [30, 18], [52, 17], [64, 34]].map(([x, y], i) => sq(x, y, 9, i * 17)).join(' ')}"/>`,
    `<path fill="${NIGHT_700}" stroke="${INK_BG}" stroke-width="1.8" d="M30 48 H56 V62 H50 L46 70 H40 L36 62 H30 Z"/>`,
    `<path fill="${COUNTER}" stroke="${INK_BG}" stroke-width="1.6" d="M72 48 H86 V74 H72 Z"/>`,
    `<path fill="#7FD4FF" d="${ringPath(79, 54, 2.4)} ${ringPath(79, 61, 2.4)} ${ringPath(79, 68, 2.4)}"/>`,
    steelBody('M4 82 H96 V88 H4 Z'),
  ];
  return svg('as-station as-ice as-dispenser', '0 0 100 90', body.join(''));
}

export function potRigSVG(lv = 1) {
  const parts = [];
  if (lv >= 3) {
    // double burner: a ring of blue-cored flames under the pot
    let fl = '';
    let core = '';
    for (let i = 0; i < 7; i++) {
      const x = 22 + i * 11;
      fl += `M${x - 5} 112 Q${x - 4} 100 ${x} 94 Q${x + 4} 100 ${x + 5} 112 Z `;
      core += `M${x - 2.4} 112 Q${x - 2} 106 ${x} 103 Q${x + 2} 106 ${x + 2.4} 112 Z `;
    }
    parts.push(`<path fill="${COUNTER_LO}" d="M10 110 H100 V118 H10 Z"/><path fill="${TAKE}" d="${fl}"/><path fill="#7FD4FF" d="${core}"/>`);
  }
  if (lv >= 4) {
    // auto refill hopper behind the pot, with an arm down to the rim
    parts.push(steelBody('M2 -44 H40 L28 -10 H14 Z'));
    parts.push(`<path fill="${PEARL}" d="${ringPath(12, -36, 3.4)} ${ringPath(21, -38, 3.4)} ${ringPath(30, -36, 3.4)} ${ringPath(17, -30, 3)} ${ringPath(25, -30, 3)}"/>`);
    parts.push(`<path fill="none" stroke="${INK_BG}" stroke-width="7" stroke-linecap="round" d="M21 -10 V8 Q21 22 36 30"/><path fill="none" stroke="${STEEL_HI}" stroke-width="3.6" stroke-linecap="round" d="M21 -10 V8 Q21 22 36 30"/>`);
    parts.push(`<path fill="${MINT}" stroke="${INK_BG}" stroke-width="1.4" d="${ringPath(34, -20, 3.4)}"/>`);
  }
  return svg('as-pot-rig', '0 0 110 110', parts.join(''), ` data-lv="${int(lv, 1, 4, 1)}"`);
}

export function goldenCardSVG() {
  return svg('as-golden-card', '0 0 70 60', `<path fill="${INK_BG}" d="M8 58 L14 6 H56 L62 58 Z"/><path fill="${PAPER}" stroke="${INK_BG}" stroke-width="2" d="M12 54 L17 8 H53 L58 54 Z"/>` +
    `<path fill="${TAKE}" stroke="${INK}" stroke-width="2" stroke-linejoin="round" d="M26 18 H44 L42 46 H28 Z"/><path fill="none" stroke="${INK}" stroke-width="2" d="M24 18 H46 M38 18 L42 10"/>` +
    `<path fill="${GOLD_HI}" stroke="${TAKE_DEEP}" stroke-width="1" d="M50 22 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z M18 34 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 Z"/>`);
}
