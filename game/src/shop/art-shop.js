// art-shop.js — gameplay v3 work-area art as SVG strings. PLACEHOLDER build: simple shapes behind the agreed function
// names and viewBoxes, so the station art drawn in parallel (same file name, same contract) can replace this file
// as is. Pure string templates (no DOM), palette from docs/art-direction-v2.md 2.1; only drinks are green.
//
// ─── Export contract ───────────────────────────────────────────────────────────────────────────
//   cupSVG({ tea, toppings, ice, sugar, sealed })  <svg class="as-cup">, viewBox 0 0 100 160 (1:1.6), bottom y ≈ 153
//   teaTankSVG(kind)                       <svg class="as-station as-tank">, viewBox 0 0 100 140
//   toppingTraySVG(kind, scoopsLeft = 10)  <svg class="as-station as-tray">, viewBox 0 0 100 90
//   iceBinSVG()                            <svg class="as-station as-ice">, viewBox 0 0 100 90
//   syrupSVG()                             <svg class="as-station as-syrup">, viewBox 0 0 70 130
//   sealerSVG(state = 'idle'|'busy')       <svg class="as-station as-sealer">, viewBox 0 0 110 150 (cup plate at 55, 136)
//   potSVG({ scoops, cookingPct })         <svg class="as-station as-pot">, viewBox 0 0 110 110
//   cupRackSVG()                           <svg class="as-station as-rack">, viewBox 0 0 100 110
//   trashSVG()                             <svg class="as-station as-trash">, viewBox 0 0 80 110
//   workSlotSVG()                          <svg class="as-station as-slot">, viewBox 0 0 100 50
//   orderBubbleSVG({ tea, toppings, ice, sugar, count })  <svg class="as-bubble">, viewBox 0 0 120 100, tail bottom
//                                          left; icons only (no ice / sugar icon = 0 taps), ×N badge when count > 1
//   coinSVG()                              <svg class="as-coin">, viewBox 0 0 40 40
//   patienceRingSVG(pct)                   <svg class="as-patience">, viewBox 0 0 40 40
//   counterBackdropSVG()                   <svg class="as-backdrop">, viewBox 0 0 360 300
//   TEA_KINDS, TOPPING_KINDS, TEA_COLORS, ART_SHOP_VERSION (0 = placeholder)

export const ART_SHOP_VERSION = 0;
export const TEA_KINDS = ['black', 'green', 'jade'];
export const TOPPING_KINDS = ['pearl', 'coconut', 'pudding', 'grass'];
export const TEA_COLORS = {
  black: { body: '#C8915C', label: '#8A4A24' },
  green: { body: '#CFE39A', label: '#5E9A48' },
  jade: { body: '#93DB52', label: '#2E9E46' },
};

const INK = '#1B1311';
const INK_BG = '#4A2C1C';
const PAPER = '#FFF7E6';
const PAPER_SH = '#EAD8B4';
const GUN = '#EE4130';
const TAKE = '#FFC21A';
const TAKE_DEEP = '#DE9800';
const LEMON = '#FFD84A';
const MINT = '#3CC98E';
const STEEL_HI = '#F2F4F7';
const STEEL = '#BCC3CE';
const STEEL_LO = '#737C8C';
const COUNTER = '#2A2142';
const PEARL = '#2B1A12';
const COCO = '#F4ECCB';
const PUDDING = '#F6C356';
const CARAMEL = '#A9561C';
const GRASS = '#2A2A1E';
const ICE = '#E6F6FF';
const ICE_EDGE = '#86BCD8';
const SYRUP = '#E9A23B';
const TOP_FILL = { pearl: PEARL, coconut: COCO, pudding: PUDDING, grass: GRASS };

const r1 = (n) => Math.round(n * 10) / 10;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const int = (v, lo, hi) => clamp(Math.round(Number(v) || 0), lo, hi);
const svg = (cls, vb, body, attrs = '') => `<svg class="${cls}" viewBox="${vb}" overflow="visible" aria-hidden="true"${attrs}>${body}</svg>`;
const ring = (cx, cy, r) => `M${r1(cx - r)} ${r1(cy)} a${r} ${r} 0 1 0 ${r1(2 * r)} 0 a${r} ${r} 0 1 0 ${r1(-2 * r)} 0`;
const sq = (cx, cy, s, a = 0) => {
  const t = (a * Math.PI) / 180;
  const h = s / 2;
  const p = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => `${r1(cx + x * Math.cos(t) - y * Math.sin(t))} ${r1(cy + x * Math.sin(t) + y * Math.cos(t))}`);
  return `M${p[0]} L${p[1]} L${p[2]} L${p[3]} Z`;
};
const teaOk = (t) => (TEA_KINDS.includes(t) ? t : null);
const topsOk = (a) => (Array.isArray(a) ? a.filter((k) => TOPPING_KINDS.includes(k)).slice(0, 3) : []);

function topShape(k, x, y, s = 1) {
  if (k === 'pearl') return ring(x, y, 4.4 * s);
  if (k === 'pudding') return `M${r1(x - 5 * s)} ${r1(y + 4 * s)} L${r1(x - 4 * s)} ${r1(y - 4 * s)} H${r1(x + 4 * s)} L${r1(x + 5 * s)} ${r1(y + 4 * s)} Z`;
  return sq(x, y, 8 * s, k === 'coconut' ? -12 : 10);
}

// ─── cup ───
export function cupSVG(o = {}) {
  const tea = teaOk(o.tea);
  const tops = topsOk(o.toppings);
  const ice = int(o.ice, 0, 2);
  const sugar = int(o.sugar, 0, 2);
  const sealed = !!o.sealed;
  const cup = 'M13 24 H87 L77 152 H23 Z';
  const p = [];
  p.push(`<ellipse cx="50" cy="154" rx="30" ry="4" fill="${INK}" fill-opacity=".25"/>`);
  p.push(`<path fill="#EAF6FB" fill-opacity=".55" d="${cup}"/>`);
  if (tea) {
    const c = TEA_COLORS[tea].body;
    p.push(`<path class="as-liquid" fill="${c}" d="M17.3 46 H82.7 L77 152 H23 Z"/>`);
    p.push(`<path fill="${INK}" fill-opacity=".12" d="M66 46 H82.7 L77 152 H64 Z"/>`);
    if (tea === 'jade') p.push(`<path fill="${LEMON}" stroke="#E2A800" stroke-width="1.4" d="${ring(36, 64, 7)}"/><path fill="none" stroke="#E2A800" stroke-width="1" d="M36 57 V71 M29 64 H43"/>`);
  }
  // toppings: layers from the bottom
  tops.forEach((k, li) => {
    const y = 144 - li * 11;
    const d = [24, 34, 44, 54, 64, 74].filter((x) => x > 24 + li * 0.8 && x < 76 - li * 0.8).map((x, i) => topShape(k, x + (i % 2) * 1.5, y - (i % 2) * 2, 1)).join(' ');
    p.push(`<path fill="${TOP_FILL[k]}" stroke="${INK}" stroke-width="1" d="${d}"/>`);
    if (k === 'pudding') p.push(`<path fill="${CARAMEL}" d="${[28, 48, 68].map((x) => `M${x - 4} ${y - 4} H${x + 4} V${y - 2} H${x - 4} Z`).join(' ')}"/>`);
  });
  // ice cubes float under the surface
  if (ice) {
    const cubes = ice === 1 ? [[40, 56, -10], [60, 60, 14]] : [[30, 54, -10], [48, 60, 12], [66, 54, -6], [40, 72, 20], [58, 76, -14]];
    p.push(`<path fill="${ICE}" fill-opacity=".85" stroke="${ICE_EDGE}" stroke-width="1.4" d="${cubes.map(([x, y, a]) => sq(x, y, 12, a)).join(' ')}"/>`);
  }
  p.push(`<path fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" d="${cup}"/>`);
  p.push(`<path fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".7" d="M21 34 L28 140"/>`);
  // sugar sticker: 0–2 syrup drops on a paper label
  if (sugar) {
    p.push(`<rect x="58" y="96" width="22" height="16" rx="3" fill="${PAPER}" stroke="${INK}" stroke-width="1.4" transform="rotate(4 69 104)"/>`);
    p.push(`<path fill="${SYRUP}" stroke="${INK}" stroke-width=".8" d="${Array.from({ length: sugar }, (_, i) => ring(64 + i * 9, 105, 3)).join(' ')}"/>`);
  }
  if (sealed) {
    p.push(`<path class="as-film" fill="${GUN}" stroke="${INK}" stroke-width="2.2" d="M11 18 H89 L87 28 H13 Z"/>`);
    p.push(`<path fill="${PAPER}" d="M24 21 H76 V25 H24 Z"/><text x="50" y="25" font-family="'Baloo 2', sans-serif" font-weight="800" font-size="6" text-anchor="middle" fill="${GUN}">250</text>`);
  } else {
    p.push(`<path fill="none" stroke="${INK}" stroke-width="3" d="M11 24 H89"/>`);
  }
  return svg('as-cup', '0 0 100 160', p.join(''), ` data-tea="${tea || ''}" data-sealed="${sealed ? 1 : 0}"`);
}

// ─── stations ───
export function teaTankSVG(kind = 'black') {
  const t = TEA_COLORS[teaOk(kind) || 'black'];
  const body = [
    `<ellipse cx="50" cy="134" rx="36" ry="5" fill="${INK}" fill-opacity=".25"/>`,
    `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="2" d="M16 18 Q16 10 24 10 H76 Q84 10 84 18 V112 Q84 120 76 120 H24 Q16 120 16 112 Z"/>`,
    `<path fill="${STEEL_HI}" d="M22 16 H32 V114 H22 Z"/>`,
    `<path fill="${STEEL_LO}" d="M70 16 H80 V114 H70 Z" opacity=".5"/>`,
    `<path fill="${t.body}" stroke="${INK_BG}" stroke-width="1.6" d="M26 40 H74 V84 H26 Z"/>`,
    `<path fill="${t.label}" d="M26 40 H74 V50 H26 Z"/>`,
    kind === 'jade' ? `<path fill="${LEMON}" stroke="#E2A800" stroke-width="1.4" d="${ring(50, 67, 9)}"/>` : `<path fill="#FFFFFF" fill-opacity=".35" d="M36 58 Q50 52 64 58 Q60 76 50 78 Q40 76 36 58 Z"/>`,
    `<path fill="${STEEL_LO}" stroke="${INK_BG}" stroke-width="2" d="M44 120 H56 V128 H44 Z"/>`,
    `<path fill="${INK_BG}" d="M38 4 H62 V10 H38 Z"/>`,
  ];
  return svg('as-station as-tank', '0 0 100 140', body.join(''), ` data-kind="${teaOk(kind) || 'black'}"`);
}

export function toppingTraySVG(kind = 'pearl', scoopsLeft = 10) {
  const k = TOPPING_KINDS.includes(kind) ? kind : 'pearl';
  const left = int(scoopsLeft, 0, 99);
  const n = k === 'pearl' ? Math.min(12, Math.ceil(left * 1.2)) : 12;
  const spots = [];
  for (let i = 0; i < n; i++) spots.push(topShape(k, 22 + (i % 6) * 11.2, 44 + Math.floor(i / 6) * 13 + ((i % 2) * 3), 1.15));
  const body = [
    `<ellipse cx="50" cy="84" rx="42" ry="5" fill="${INK}" fill-opacity=".25"/>`,
    `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="2" d="M6 30 H94 L88 78 H12 Z"/>`,
    `<path fill="${STEEL_LO}" d="M12 36 H88 L84 72 H16 Z"/>`,
    spots.length ? `<path fill="${TOP_FILL[k]}" stroke="${INK}" stroke-width="1" d="${spots.join(' ')}"/>` : '',
    k === 'pudding' && spots.length ? `<path fill="${CARAMEL}" d="${spots.slice(0, 6).map((_, i) => `M${18 + i * 11.2} 38 h8 v2 h-8 Z`).join(' ')}"/>` : '',
    `<path fill="none" stroke="${STEEL_HI}" stroke-width="3" d="M10 32 H90"/>`,
  ];
  return svg('as-station as-tray', '0 0 100 90', body.join(''), ` data-kind="${k}" data-left="${left}"`);
}

export function iceBinSVG() {
  const cubes = [[24, 44, -10], [40, 40, 12], [56, 44, -4], [72, 40, 16], [32, 58, 8], [50, 58, -14], [68, 58, 6]];
  const body = [
    `<ellipse cx="50" cy="84" rx="42" ry="5" fill="${INK}" fill-opacity=".25"/>`,
    `<path fill="#5FA9D6" stroke="${INK_BG}" stroke-width="2" d="M8 28 H92 L88 80 H12 Z"/>`,
    `<path fill="#DFF1FB" d="M14 34 H86 L84 70 H16 Z"/>`,
    `<path fill="${ICE}" stroke="${ICE_EDGE}" stroke-width="1.6" d="${cubes.map(([x, y, a]) => sq(x, y, 13, a)).join(' ')}"/>`,
    `<path fill="#FFFFFF" d="${cubes.map(([x, y, a]) => sq(x - 2, y - 2, 4, a)).join(' ')}"/>`,
  ];
  return svg('as-station as-ice', '0 0 100 90', body.join(''));
}

export function syrupSVG() {
  const body = [
    `<ellipse cx="35" cy="125" rx="24" ry="4" fill="${INK}" fill-opacity=".25"/>`,
    `<path fill="${SYRUP}" fill-opacity=".9" stroke="${INK_BG}" stroke-width="2" d="M14 50 Q14 42 22 42 H48 Q56 42 56 50 V116 Q56 122 50 122 H20 Q14 122 14 116 Z"/>`,
    `<path fill="#FFFFFF" fill-opacity=".35" d="M20 50 H26 V114 H20 Z"/>`,
    `<path fill="${PAPER}" stroke="${INK_BG}" stroke-width="1.4" d="M20 70 H50 V96 H20 Z"/>`,
    `<path fill="${SYRUP}" stroke="${INK}" stroke-width="1" d="M35 74 Q42 84 40 88 A5 5 0 0 1 30 88 Q28 84 35 74 Z"/>`,
    `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="2" d="M28 22 H42 V42 H28 Z M24 14 H60 V22 H24 Z"/>`,
    `<path fill="${STEEL_LO}" d="M56 14 H64 V26 H58 Z"/>`,
  ];
  return svg('as-station as-syrup', '0 0 70 130', body.join(''));
}

export function sealerSVG(state = 'idle') {
  const busy = state === 'busy';
  const body = [
    `<ellipse cx="55" cy="144" rx="46" ry="5" fill="${INK}" fill-opacity=".25"/>`,
    `<path fill="${COUNTER}" stroke="${INK_BG}" stroke-width="2" d="M10 20 Q10 8 22 8 H88 Q100 8 100 20 V44 H10 Z"/>`,
    `<g class="as-sealer-head" transform="translate(0 ${busy ? 18 : 0})"><path fill="${STEEL}" stroke="${INK_BG}" stroke-width="2" d="M24 44 H86 V58 H24 Z"/><path fill="${GUN}" d="M24 54 H86 V58 H24 Z"/></g>`,
    `<path fill="${STEEL_LO}" stroke="${INK_BG}" stroke-width="2" d="M14 44 H24 V140 H14 Z M86 44 H96 V140 H86 Z"/>`,
    `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="2" d="M8 136 H102 V146 H8 Z"/>`,
    `<circle cx="88" cy="24" r="5" fill="${busy ? GUN : MINT}" stroke="${INK_BG}" stroke-width="1.6"/>`,
    `<path fill="${PAPER}" d="M22 18 H70 V30 H22 Z" opacity=".9"/><text x="46" y="28" font-family="'Baloo 2', sans-serif" font-weight="800" font-size="10" text-anchor="middle" fill="${GUN}">250</text>`,
  ];
  return svg('as-station as-sealer', '0 0 110 150', body.join(''), ` data-state="${busy ? 'busy' : 'idle'}"`);
}

export function potSVG(o = {}) {
  const scoops = int(o.scoops, 0, 99);
  const cooking = clamp(Number(o.cookingPct) || 0, 0, 1);
  const n = Math.min(14, Math.ceil(scoops * 1.4));
  const pearls = Array.from({ length: n }, (_, i) => ring(28 + (i % 7) * 9, 46 + Math.floor(i / 7) * 9 + (i % 2) * 2, 4)).join(' ');
  const body = [
    `<ellipse cx="55" cy="104" rx="44" ry="5" fill="${INK}" fill-opacity=".25"/>`,
    `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="2.2" d="M14 40 H96 V88 Q96 100 84 100 H26 Q14 100 14 88 Z"/>`,
    `<path fill="${STEEL_LO}" stroke="${INK_BG}" stroke-width="2" d="M4 44 H14 V54 H4 Z M96 44 H106 V54 H96 Z"/>`,
    `<ellipse cx="55" cy="40" rx="41" ry="9" fill="#5B3A24" stroke="${INK_BG}" stroke-width="2"/>`,
    n ? `<path fill="${PEARL}" stroke="#000" stroke-width=".6" d="${pearls}" transform="translate(0 -10)"/>` : '',
    cooking ? `<path class="as-steam" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".8" d="M36 26 Q30 16 38 8 M56 24 Q50 12 58 4 M74 26 Q68 16 76 8"/>` : '',
    cooking ? `<circle cx="55" cy="72" r="15" fill="${COUNTER}" fill-opacity=".8"/><circle class="as-pot-timer" cx="55" cy="72" r="13" fill="none" stroke="${LEMON}" stroke-width="4" pathLength="100" stroke-dasharray="${r1(cooking * 100)} 100" transform="rotate(-90 55 72)"/>` : '',
    !cooking && scoops === 0 ? `<path fill="${GUN}" stroke="${INK}" stroke-width="1.6" d="M48 62 H62 L58 84 H52 Z M52 88 H58 V94 H52 Z"/>` : '',
  ];
  return svg('as-station as-pot', '0 0 110 110', body.join(''), ` data-scoops="${scoops}" data-cooking="${cooking ? 1 : 0}"`);
}

export function cupRackSVG() {
  const cups = [0, 1, 2].map((i) => {
    const x = 14 + i * 26;
    return `<path fill="#EAF6FB" fill-opacity=".8" stroke="${INK_BG}" stroke-width="1.8" d="M${x} 30 H${x + 22} L${x + 19} 70 H${x + 3} Z M${x} 38 H${x + 22} M${x} 46 H${x + 22}"/>`;
  });
  const body = [
    `<ellipse cx="50" cy="104" rx="44" ry="5" fill="${INK}" fill-opacity=".25"/>`,
    `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="2" d="M6 70 H94 V98 H6 Z"/>`,
    `<path fill="${STEEL_HI}" d="M8 72 H92 V76 H8 Z"/>`,
    ...cups,
  ];
  return svg('as-station as-rack', '0 0 100 110', body.join(''));
}

export function trashSVG() {
  const body = [
    `<ellipse cx="40" cy="104" rx="32" ry="5" fill="${INK}" fill-opacity=".25"/>`,
    `<path fill="#4E5A6C" stroke="${INK_BG}" stroke-width="2" d="M12 30 H68 L62 100 H18 Z"/>`,
    `<path fill="none" stroke="${STEEL_LO}" stroke-width="2" d="M28 40 L30 92 M40 40 V92 M52 40 L50 92"/>`,
    `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="2" d="M6 22 H74 V30 H6 Z M32 14 H48 V22 H32 Z"/>`,
  ];
  return svg('as-station as-trash', '0 0 80 110', body.join(''));
}

export function workSlotSVG() {
  const body = [
    `<ellipse cx="50" cy="28" rx="46" ry="16" fill="${STEEL_LO}" stroke="${INK_BG}" stroke-width="2"/>`,
    `<ellipse cx="50" cy="25" rx="40" ry="12" fill="${STEEL}"/>`,
    `<path fill="none" stroke="${STEEL_HI}" stroke-width="2" d="M18 22 Q50 10 82 22"/>`,
  ];
  return svg('as-station as-slot', '0 0 100 50', body.join(''));
}

// ─── order bubble ───
export function orderBubbleSVG(order = {}) {
  const tea = teaOk(order.tea);
  const tops = topsOk(order.toppings);
  const ice = int(order.ice, 0, 2);
  const sugar = int(order.sugar, 0, 2);
  const count = Math.max(1, Math.round(Number(order.count) || 1));
  const shape = 'M20 4 H100 Q116 4 116 20 V64 Q116 80 100 80 H36 L22 98 L24 80 H20 Q4 80 4 64 V20 Q4 4 20 4 Z';
  const p = [
    `<path fill="${PAPER_SH}" d="${shape}" transform="translate(0 3)"/>`,
    `<path fill="${PAPER}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" d="${shape}"/>`,
  ];
  const cupD = 'M12 20 H40 L36 72 H16 Z';
  p.push(`<path fill="#DDEFF7" d="${cupD}"/>`);
  if (tea) p.push(`<path fill="${TEA_COLORS[tea].body}" d="M13.3 30 H38.7 L36 72 H16 Z"/>`);
  if (tea === 'jade') p.push(`<path fill="${LEMON}" stroke="#E2A800" stroke-width="1.2" d="${ring(21, 40, 4.6)}"/>`);
  tops.forEach((k, i) => p.push(`<path fill="${TOP_FILL[k]}" stroke="${INK}" stroke-width=".6" d="${[19.5, 26, 32.5].map((x) => ring(x, 68 - i * 5.4, 2.4)).join(' ')}"/>`));
  p.push(`<path fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" d="${cupD} M10 20 H42"/><path fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" d="M30 20 L35 9"/>`);
  const rows = [];
  if (tops.length) rows.push('t');
  if (ice) rows.push('i');
  if (sugar) rows.push('s');
  const gap = rows.length ? 66 / rows.length : 0;
  rows.forEach((row, ri) => {
    const y = r1(9 + gap * (ri + 0.5));
    if (row === 't') tops.forEach((k, i) => p.push(`<path fill="${TOP_FILL[k]}" stroke="${INK}" stroke-width="1.4" d="${topShape(k, 58 + i * 17, y, 1.25)}"/>`));
    else if (row === 'i') p.push(`<path fill="${ICE}" stroke="${ICE_EDGE}" stroke-width="1.6" d="${Array.from({ length: ice }, (_, i) => sq(58 + i * 17, y, 11, i ? 10 : -8)).join(' ')}"/>`);
    else p.push(`<path fill="${SYRUP}" stroke="${INK}" stroke-width="1.4" d="${Array.from({ length: sugar }, (_, i) => { const x = 58 + i * 17; return `M${x} ${y - 7} Q${x + 6} ${y} ${x + 5} ${y + 2.6} A5.2 5.2 0 0 1 ${x - 5} ${y + 2.6} Q${x - 6} ${y} ${x} ${y - 7} Z`; }).join(' ')}"/>`);
  });
  if (count > 1) {
    p.push(`<path fill="${GUN}" stroke="${INK}" stroke-width="2.2" d="${ring(110, 8, 12)}"/>`);
    p.push(`<text x="110" y="13" font-family="'Baloo 2', sans-serif" font-weight="800" font-size="14" text-anchor="middle" fill="${PAPER}">×${count}</text>`);
  }
  return svg('as-bubble', '0 0 120 100', p.join(''), ` data-count="${count}"`);
}

export function coinSVG() {
  return svg('as-coin', '0 0 40 40', `<path fill="${TAKE_DEEP}" d="${ring(20, 21.6, 17)}"/><path fill="${TAKE}" stroke="#A85F00" stroke-width="2" d="${ring(20, 20, 17)}"/>` +
    `<path fill="none" stroke="${TAKE_DEEP}" stroke-width="1.4" d="${ring(20, 20, 13)}"/><text x="20" y="24.4" font-family="'Baloo 2', sans-serif" font-weight="800" font-size="11" text-anchor="middle" fill="#A85F00">NT$</text>`);
}

export function patienceRingSVG(pct = 1) {
  const p = clamp(Number(pct) || 0, 0, 1);
  const col = p >= 0.5 ? MINT : p >= 0.25 ? TAKE : GUN;
  return svg('as-patience', '0 0 40 40', `<circle cx="20" cy="20" r="16" fill="#1B2040" fill-opacity=".55" stroke="#151026" stroke-width="5"/>` +
    `<circle class="as-pr-arc" cx="20" cy="20" r="16" fill="none" stroke="${col}" stroke-width="4.2" stroke-linecap="round" pathLength="100" stroke-dasharray="${r1(p * 100)} 100" transform="rotate(-90 20 20)"/>`, ` data-pct="${r1(p)}"`);
}

export function counterBackdropSVG() {
  const tiles = [];
  for (let y = 0; y < 150; y += 16) for (let x = (y / 16) % 2 ? -12 : 0; x < 360; x += 24) tiles.push(`M${x} ${y} h24 v16 h-24 Z`);
  return svg('as-backdrop', '0 0 360 300', `<rect width="360" height="300" fill="#EBC08A"/><path fill="#F3D2A2" stroke="#C7925E" stroke-width="1" d="${tiles.join(' ')}"/>` +
    `<path fill="${STEEL}" d="M0 150 H360 V166 H0 Z"/><path fill="${STEEL_HI}" d="M0 150 H360 V153 H0 Z"/><path fill="#8D96A6" d="M0 166 H360 V300 H0 Z"/>`, ' preserveAspectRatio="xMidYMid slice"');
}
