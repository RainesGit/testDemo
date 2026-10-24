// art-shop.js — gameplay v3 work-table art (docs/gameplay-v3-shop.md 3, 10, 10.9) as SVG strings, drawn for the tilted
// camera of docs/art-direction-v2.md 13: everything on the table is seen in three-quarter view from above (you look into
// the pot, the cup mouths, the topping pans, onto the tops of the tanks and the sealer), lit by one warm key light from the
// upper left. Volume comes from the shared shading overlays of art-kit.js (SHOP_DEFS: body gradients, specular streaks,
// soft radial contact shadows, rim light), outlines are thin and in a darker shade of each prop's own colour. Clear cups are
// semi-transparent: the tea, ice, toppings and foam show through the plastic with refraction-like shading.
// Pure string templates: no DOM, no randomness except seeded (same input -> same output), safe in node tests. Only drinks
// are green (art direction 2.1). No filters, no blur, no external images.
//
// ─── Export contract (consumed by the v3 shop UI) ──────────────────────────────────────────────
//   cupSVG({ tea, milk, toppings, ice, sugar, foam, lemon, shaken, sealed })   <svg class="as-cup">, viewBox 0 0 100 150;
//       tea: null | 'black' | 'green' | 'jade'; toppings: up to 3 of TOPPING_KINDS (first = bottom layer); ice 0..2; sugar
//       0..2; milk → milk tea colour + a swirl; foam → a cheese-foam cap; lemon → a lemon wheel; shaken → froth on top;
//       sealed: printed film lid with the 250 logo. data-tea / data-sealed on the <svg>. The cup bottom sits at y ≈ 146.
//   teaTankSVG(kind, { fast })             <svg class="as-station as-tank" data-kind>, viewBox 0 0 100 155, label 紅茶/綠茶/翡翠檸檬
//   toppingTraySVG(kind, scoopsLeft = 10)  <svg class="as-station as-tray" data-kind data-left>, viewBox 0 0 100 95
//   iceBinSVG() / iceDispenserSVG()        <svg class="as-station as-ice">, viewBox 0 0 100 95
//   syrupSVG()                             <svg class="as-station as-syrup">, viewBox 0 0 70 108, label 果糖
//   sealerSVG(state = 'idle', { turbo })   <svg class="as-station as-sealer" data-state="idle|busy">, viewBox 0 0 110 150;
//                                          the cup stands on the platform at (55, 136); g.as-sealer-head moves down when busy
//   potSVG({ scoops, cookingPct })         <svg class="as-station as-pot" data-scoops data-cooking>, viewBox 0 0 110 105;
//                                          circle.as-pot-timer (pathLength 100) is the ring timer while cooking
//   potRigSVG(lv)                          <svg class="as-pot-rig" data-lv>, viewBox 0 0 110 105: burner (Lv3+), hopper (Lv4)
//   cupRackSVG()                           <svg class="as-station as-rack">, viewBox 0 0 100 125
//   trashSVG()                             <svg class="as-station as-trash">, viewBox 0 0 80 108
//   workSlotSVG()                          <svg class="as-station as-slot">, viewBox 0 0 100 50 (cup centre at x 50, y ≈ 25)
//   shelfSVG(n, { autoSeal })              <svg class="as-shelf" data-n>, viewBox 0 0 240 250: two tiers of 3 holders (cups
//                                          stand at y 114 / 240), spots ≥ n locked; autoSeal (seal4) adds the gantry
//   tableSVG()                             <svg class="as-table">, viewBox 0 0 1280 436 (design y − 284): the back wall (tiles,
//                                          stickers), the back bench, the receding steel worktop under the warm key light,
//                                          the terracotta prep mat in perspective, wood edges, light falloff to the edges
//   counterLipSVG()                        <svg class="as-lip">, viewBox 0 0 1280 16: the counter top edge
//   orderBubbleSVG(item) / itemsBubbleSVG(order, got, { gotSnack })   order bubbles, icons only: one card per cup (2×2 for
//                                          four), a snack card, a shaker badge (day 3 on), a carry bag on big orders, ticks
//   lockedSVG(kind) / lockBadgeSVG()       covered spots with a padlock badge (every station kind, see LOCK_VB)
//   teaManifoldSVG(n), goldenCardSVG(), coinSVG(), patienceRingSVG(pct), patienceColor(pct), counterBackdropSVG()
//   TEA_KINDS, TOPPING_KINDS, TEA_COLORS, TOPPING_COLORS, CARD, BUBBLE_TAIL, ART_SHOP_VERSION; SHOP_DEFS (re-export)
import { PALETTE, mixColor, celShade, celHilite, ringPath, mulberry32, fnv1a } from '../art.js';
import { SHOP_DEFS, G, ell, ao, cast, over, line, lit, dark, r1 } from './art-kit.js';

export { SHOP_DEFS };
export const ART_SHOP_VERSION = 2;

const { INK, INK_BG, PAPER, PAPER_SH, GUN, GUN_DEEP, TAKE, TAKE_DEEP, LEMON, GOLD_HI, MINT, STEEL_HI, STEEL, STEEL_LO,
  NIGHT_700, NIGHT_900, COUNTER, COUNTER_LO, WARM_RIM, SHUT } = PALETTE;

export const TEA_KINDS = ['black', 'green', 'jade'];
export const TOPPING_KINDS = ['pearl', 'coconut', 'pudding', 'grass', 'taro', 'bean'];

// Drink colours (drinks only): plain tea, its milk-tea version, the tank label colour.
export const TEA_COLORS = {
  black: { body: '#B8662F', milk: '#C99566', label: '#8A4A24', name: '紅茶' },   // amber black tea / caramel milk tea
  green: { body: '#CBD97E', milk: '#DCE2B4', label: '#5E9A48', name: '綠茶' },   // pale green tea / green milk tea
  jade: { body: '#9BD957', milk: '#C8E59A', label: '#2E9E46', name: '翡翠檸檬' }, // bright lime + lemon
};
const TOPPING_NAME = { pearl: '珍珠', coconut: '椰果', pudding: '布丁', grass: '仙草', taro: '芋圓', bean: '紅豆' };
const PEARL = '#2B1A12';
const PEARL_HI = '#8A5A3C';
const COCO = '#F4ECCB';
const PUDDING = '#F6C356';
const CARAMEL = '#A9561C';
const GRASS = '#2A2A1E';
const GRASS_HI = '#5B5C3E';
const TARO = ['#A07BD0', '#F2A65A', '#F1E3C0'];   // 芋圓: taro purple, sweet-potato orange, cream
const BEAN = '#7A2A26';
const BEAN_HI = '#C2615A';
const ICE = '#E6F6FF';
const ICE_EDGE = '#86BCD8';
const SYRUP = '#E9A23B';
const FOAM = '#FFF3D6';
export const TOPPING_COLORS = { pearl: PEARL, coconut: COCO, pudding: PUDDING, grass: GRASS, taro: TARO[0], bean: BEAN };

const FONT_ZH = `font-family="Huninn, 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"`;
const FONT_NUM = `font-family="'Baloo 2', 'Noto Sans TC', sans-serif" font-weight="800"`;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const int = (v, lo, hi, d = lo) => clamp(Math.round(Number.isFinite(Number(v)) ? Number(v) : d), lo, hi);
const svg = (cls, vb, body, attrs = '') => `<svg class="${cls}" viewBox="${vb}" overflow="visible" aria-hidden="true"${attrs}>${body}</svg>`;
const P = (fill, d, extra = '') => `<path fill="${fill}"${extra} d="${d}"/>`;
const S = (stroke, w, d, extra = '') => `<path fill="none" stroke="${stroke}" stroke-width="${w}"${extra} d="${d}"/>`;
// A rotated square (cx, cy, side s, angle a in degrees), squashed vertically by k (perspective), as a path fragment.
function sq(cx, cy, s, a, k = 1) {
  const t = (a * Math.PI) / 180;
  const h = s / 2;
  const pts = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => `${r1(cx + x * Math.cos(t) - y * Math.sin(t))} ${r1(cy + (x * Math.sin(t) + y * Math.cos(t)) * k)}`);
  return `M${pts[0]} L${pts[1]} L${pts[2]} L${pts[3]} Z`;
}
// Centred positions from a to b, step apart; odd rows get one fewer (a half-step stagger like a real pile).
function spread(a, b, step, odd) {
  let n = Math.max(1, Math.floor((b - a) / step) + 1);
  if (odd && n > 1) n -= 1;
  const start = (a + b) / 2 - ((n - 1) * step) / 2;
  return Array.from({ length: n }, (_, i) => start + i * step);
}
const ring = ringPath;
const label = (x, y, text, size, fill = INK, extra = '') => `<text x="${x}" y="${y}" ${FONT_ZH} font-size="${size}" text-anchor="middle" fill="${fill}"${extra}>${text}</text>`;

// ─── The cup (hero): clear plastic in three-quarter view from above ────────────────────────────
const RIM_Y = 24;
const RIM_RX = 44;
const RIM_RY = 14;
const BOT_Y = 136;
const BOT_RX = 30;
const BOT_RY = 9;
const wallX = (y) => 50 - RIM_RX + ((y - RIM_Y) * (RIM_RX - BOT_RX)) / (BOT_Y - RIM_Y); // left wall x at y
const SURF_Y = 37;   // tea surface
const LAYER_H = 13;  // one topping scoop
const IN_BOT = 142;  // the front of the inside bottom
const BODY = `M${50 - RIM_RX} ${RIM_Y} L${50 - BOT_RX} ${BOT_Y} A${BOT_RX} ${BOT_RY} 0 0 0 ${50 + BOT_RX} ${BOT_Y} L${50 + RIM_RX} ${RIM_Y} Z`;

function normCup(o = {}) {
  const tea = TEA_KINDS.includes(o.tea) ? o.tea : null;
  const toppings = (Array.isArray(o.toppings) ? o.toppings : []).filter((t) => TOPPING_KINDS.includes(t)).slice(0, 3);
  return { tea, toppings, ice: int(o.ice, 0, 2, 0), sugar: int(o.sugar, 0, 2, 0), sealed: !!o.sealed, milk: !!o.milk && !!tea, foam: !!o.foam,
    lemon: !!o.lemon, shaken: !!o.shaken && !!tea };
}
const teaColor = (c) => (c.tea ? (c.milk ? TEA_COLORS[c.tea].milk : TEA_COLORS[c.tea].body) : null);

// Topping layer i (0 = bottom), seen through the front wall.
function toppingLayer(kind, i, seed, top = false) {
  const yB = IN_BOT - i * LAYER_H;
  let yT = yB - LAYER_H;
  const xl = wallX(yB - 6) + 2.5;
  const xr = 100 - xl;
  const rnd = mulberry32(seed);
  if (kind === 'pearl' || kind === 'bean') {
    const bean = kind === 'bean';
    const r = bean ? 3.4 : 4.6;
    let d = '';
    let g = '';
    for (let row = 0; row < (top ? 3 : 2); row++) {
      const y = yB - r - 1.5 - row * (bean ? 4.6 : 6.6);
      for (const x of spread(wallX(y) + 2.5 + r, 100 - wallX(y) - 2.5 - r, bean ? 7.2 : 9, row % 2)) {
        const jx = r1(x + (rnd() - 0.5) * 1.4);
        const jy = r1(y + (rnd() - 0.5) * 1.2);
        d += (bean ? ell(jx, jy, r * 1.25, r * 0.85) : ring(jx, jy, r)) + ' ';
        g += ring(r1(jx - r * 0.38), r1(jy - r * 0.4), r1(r * 0.3)) + ' ';
      }
    }
    return P(bean ? BEAN : PEARL, d, ` stroke="${bean ? '#4A1714' : '#140A06'}" stroke-width=".6"`) + P(bean ? BEAN_HI : PEARL_HI, g, ' fill-opacity=".9"') +
      P('#FFFFFF', g.replace(/a([\d.]+) ([\d.]+)/g, (m, a, b) => `a${r1(a * 0.45)} ${r1(b * 0.45)}`), ' fill-opacity=".8"');
  }
  if (kind === 'taro') {
    const parts = TARO.map(() => '');
    for (let row = 0; row < 2; row++) {
      const y = yB - 4.4 - row * 6.4;
      spread(xl + 5, xr - 5, 9, row % 2).forEach((x, k) => {
        const c = (k + row + Math.floor(rnd() * 3)) % 3;
        parts[c] += `M${r1(x - 4.4)} ${r1(y - 2.6)} q0 -2 2 -2 h4.8 q2 0 2 2 v5 q0 2 -2 2 h-4.8 q-2 0 -2 -2 Z `;
      });
    }
    return parts.map((d, k) => (d ? P(TARO[k], d, ` stroke="${line(TARO[k], 0.4)}" stroke-width=".7"`) : '')).join('') +
      P('#FFFFFF', parts.join(' ').replace(/M([\d.]+) ([\d.]+) q0 -2 2 -2 h4\.8 q2 0 2 2 v5 q0 2 -2 2 h-4\.8 q-2 0 -2 -2 Z/g, (m, x, y) => `M${r1(+x + 1.2)} ${r1(+y - 1)} h3 v1.4 h-3 Z`), ' fill-opacity=".55"');
  }
  if (kind === 'coconut') {
    let d = '';
    let g = '';
    for (let row = 0; row < 2; row++) {
      const y = yB - 4.4 - row * 6.4;
      for (const x of spread(xl + 4.6, xr - 4.6, 8.4, row % 2)) {
        const a = (rnd() - 0.5) * 40;
        d += sq(r1(x + (rnd() - 0.5)), y, 7, a) + ' ';
        g += sq(r1(x - 1.4), r1(y - 1.4), 2.2, a) + ' ';
      }
    }
    return P(COCO, d, ` fill-opacity=".86" stroke="#B9A673" stroke-width=".7" stroke-linejoin="round"`) + P('#FFFFFF', g, ' fill-opacity=".8"');
  }
  if (kind === 'pudding') {
    yT -= 3;
    const xlT = wallX(yT) + 3.5;
    const xrT = 100 - xlT;
    const mid = (xlT + xrT) / 2;
    const body = `M${r1(xl + 1)} ${yB} L${r1(xlT + 3)} ${r1(yT + 2)} Q${r1(mid)} ${r1(yT - 1)} ${r1(xrT - 3)} ${r1(yT + 2)} L${r1(xr - 1)} ${yB} Z`;
    const top = `M${r1(xlT + 3)} ${r1(yT + 2)} Q${r1(mid)} ${r1(yT - 1)} ${r1(xrT - 3)} ${r1(yT + 2)} L${r1(xrT - 2.6)} ${r1(yT + 5)} Q${r1(mid + 6)} ${r1(yT + 3)} ${r1(mid)} ${r1(yT + 6.5)} Q${r1(xlT + 10)} ${r1(yT + 3.5)} ${r1(xlT + 3.4)} ${r1(yT + 5)} Z`;
    return P(PUDDING, body, ' stroke="#B8801E" stroke-width=".8" stroke-linejoin="round"') + P(CARAMEL, top) + over(body, G.cylSoft);
  }
  // grass jelly
  let d = '';
  let g = '';
  for (let row = 0; row < 2; row++) {
    const y = yB - 4.6 - row * 6.6;
    for (const x of spread(xl + 4.8, xr - 4.8, 8.6, row % 2)) {
      const a = (rnd() - 0.5) * 30;
      d += sq(r1(x), r1(y + (rnd() - 0.5)), 7.4, a) + ' ';
      g += `M${r1(x - 2.6)} ${r1(y - 1.2)} l2 -1.6 `;
    }
  }
  return P(GRASS, d, ' stroke="#121208" stroke-width=".6" stroke-linejoin="round"') + S(GRASS_HI, 1.2, g, ' stroke-linecap="round"');
}

// Liquid body from the surface (sy) down to the bottom, following the walls.
function liquidPath(sy) {
  const xl = wallX(sy) + 1;
  return `M${r1(xl)} ${sy} L${50 - BOT_RX + 1} ${BOT_Y} A${BOT_RX - 1} ${BOT_RY - 1} 0 0 0 ${50 + BOT_RX - 1} ${BOT_Y} L${r1(100 - xl)} ${sy} Z`;
}
const surfRx = (y) => 50 - wallX(y) - 1.2;

export function cupSVG(opts = {}) {
  const c = normCup(opts);
  const seed = fnv1a(JSON.stringify(c));
  const p = [cast(50, 141, 34, 8), ao(50, 140, 38, 9)];
  const body = teaColor(c);
  const topY = IN_BOT - c.toppings.length * LAYER_H; // top of the topping pile
  // the inside of the mouth (the back wall seen through the opening) and a faint plastic tint
  p.push(P('#E3F2F9', ell(50, RIM_Y, RIM_RX, RIM_RY), ' fill-opacity=".35"'));
  p.push(P('#DDEFF7', BODY, ' fill-opacity=".18"'));
  const sy = c.foam ? SURF_Y + 6 : SURF_Y;
  if (body) {
    p.push(P(body, liquidPath(sy)));
    p.push(over(liquidPath(sy), G.liquid));
    if (c.tea === 'jade' && c.lemon) {
      // a lemon wheel pressed to the front wall
      p.push(P('#FFF6C8', ring(34, 84, 12.5), ' stroke="#E2A800" stroke-width="2.2"'));
      const seg = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = (k * Math.PI) / 4 + 0.2; return `M34 84 L${r1(34 + Math.cos(a) * 10)} ${r1(84 + Math.sin(a) * 10)}`; }).join(' ');
      p.push(P(LEMON, `${ring(34, 84, 10)} ${seg}`, ' stroke="#FFF6C8" stroke-width="1.3"'));
    }
    if (c.milk) p.push(S('#FFF4E2', 3, `M${r1(wallX(60) + 3)} 60 Q36 52 50 60 T${r1(100 - wallX(66) - 4)} 66`, ' stroke-opacity=".55" stroke-linecap="round"'));
  } else if (c.toppings.length || c.ice) {
    p.push(P('#B9D6E4', ell(50, BOT_Y, BOT_RX - 2, BOT_RY - 2), ' fill-opacity=".35"'));
  }
  c.toppings.forEach((k, i) => p.push(toppingLayer(k, i, seed + i * 7919, i === c.toppings.length - 1)));
  if (c.sugar > 0) {
    const yy = body ? Math.min(topY - 8, 112) : topY - 2;
    const d = [`M30 ${yy} q8 -6 16 -1 t16 -1 t10 3`, `M28 ${yy - 13} q9 5 18 0 t18 -1`].slice(0, c.sugar).join(' ');
    p.push(S(body ? '#FFE3A0' : SYRUP, 1.8, d, ` stroke-linecap="round" stroke-opacity="${body ? 0.55 : 0.85}"`));
  }
  if (body) {
    const rx = surfRx(sy);
    const ry = rx * (RIM_RY / RIM_RX);
    if (c.foam) {
      // the cheese-foam cap: a thick cream band over the tea, its top surface with a soft swirl and a few cheese flecks
      const band = `M${r1(wallX(SURF_Y - 1) + 1)} ${SURF_Y - 1} L${r1(wallX(sy + 4) + 1)} ${sy + 4} A${r1(surfRx(sy + 4))} ${r1(surfRx(sy + 4) * RIM_RY / RIM_RX)} 0 0 0 ${r1(100 - wallX(sy + 4) - 1)} ${sy + 4} L${r1(100 - wallX(SURF_Y - 1) - 1)} ${SURF_Y - 1} Z`;
      p.push(P(FOAM, band) + over(band, G.liquid, 0.5));
      const frx = surfRx(SURF_Y - 1);
      p.push(P(G.foam, ell(50, SURF_Y - 1, frx, frx * RIM_RY / RIM_RX)));
      p.push(S('#EBD39C', 1.6, `M34 ${SURF_Y - 2} q8 -5 16 0 t16 0`, ' stroke-linecap="round"'));
      p.push(P('#F2C14E', `${ring(40, SURF_Y + 1, 1.2)} ${ring(58, SURF_Y - 3, 1)} ${ring(63, SURF_Y + 2, 1.1)}`));
    } else {
      // the drink surface: lighter, froth after shaking, ice cubes floating, a lemon wheel
      const surf = c.shaken ? mixColor(body, '#FFF4E0', 0.55) : celHilite(body);
      p.push(P(surf, ell(50, sy, rx, ry), ` stroke="${line(body, 0.35)}" stroke-width=".8"`));
      p.push(over(ell(50, sy, rx, ry), G.top, 0.8));
      if (c.shaken) {
        const rnd = mulberry32(seed + 3);
        let b = '';
        for (let k = 0; k < 11; k++) b += ring(r1(50 + (rnd() - 0.5) * rx * 1.5), r1(sy + (rnd() - 0.5) * ry * 1.3), r1(0.9 + rnd() * 1.4)) + ' ';
        p.push(P('#FFFFFF', b, ' fill-opacity=".75"'));
      }
      if (c.milk && !c.shaken) p.push(S('#FFFFFF', 1.6, `M${50 - rx * 0.4} ${sy} q${r1(rx * 0.3)} -${r1(ry * 0.5)} ${r1(rx * 0.5)} 0 t${r1(rx * 0.3)} 0`, ' stroke-opacity=".75" stroke-linecap="round"'));
      if (c.ice > 0) {
        const spots = [[37, sy - 1, -14], [62, sy + 1, 18], [50, sy + 4, 8], [70, sy - 2, -22]].slice(0, c.ice * 2);
        const d = spots.map(([x, y, a]) => sq(x, y, 12, a, 0.62)).join(' ');
        const side = spots.map(([x, y]) => `M${x - 5.4} ${y + 2.6} h10.8 v3.4 h-10.8 Z`).join(' ');
        const g = spots.map(([x, y, a]) => sq(r1(x - 2.2), r1(y - 1.4), 4, a, 0.62)).join(' ');
        p.push(P(ICE_EDGE, side, ' fill-opacity=".55"') + P(ICE, d, ` fill-opacity=".85" stroke="${ICE_EDGE}" stroke-width=".9" stroke-linejoin="round"`) + P('#FFFFFF', g, ' fill-opacity=".95"'));
      }
      if (c.lemon) {
        p.push(P('#E2A800', ell(64, sy + 1, 11, 5), '') + P('#FFF6C8', ell(64, sy + 0.6, 9.6, 4.2)) + P(LEMON, ell(64, sy + 0.6, 8, 3.4)));
        p.push(S('#FFF6C8', 1, `M56 ${r1(sy + 0.6)} H72 M64 ${r1(sy - 2.8)} V${r1(sy + 4)} M58.4 ${r1(sy - 1.8)} L69.6 ${r1(sy + 3)} M69.6 ${r1(sy - 1.8)} L58.4 ${r1(sy + 3)}`));
      }
    }
  } else if (c.ice > 0) {
    const iy = Math.min(topY, IN_BOT) - 6;
    const spots = [[38, iy, -14], [61, iy + 1.5, 18], [49, iy + 8, 8], [68, iy + 10, -22]].slice(0, c.ice * 2);
    p.push(P(ICE, spots.map(([x, y, a]) => sq(x, y, 12, a, 0.7)).join(' '), ` fill-opacity=".8" stroke="${ICE_EDGE}" stroke-width="1" stroke-linejoin="round"`));
  }
  // the plastic in front: refraction edges, a specular streak, a thin cool outline, the base ring, the rim
  p.push(over(BODY, G.glass));
  p.push(P('#FFFFFF', `M${50 - RIM_RX + 7} ${RIM_Y + 10} L${50 - BOT_RX + 5} ${BOT_Y - 6} L${50 - BOT_RX + 8.5} ${BOT_Y - 6} L${50 - RIM_RX + 12} ${RIM_Y + 10} Z`, ' fill-opacity=".55"'));
  p.push(S('#FFFFFF', 1.1, `M${50 + RIM_RX - 9} ${RIM_Y + 16} L${50 + BOT_RX - 6} ${BOT_Y - 30}`, ' stroke-opacity=".35" stroke-linecap="round"'));
  p.push(S('#7FA6BC', 1.3, `M${50 - RIM_RX} ${RIM_Y} L${50 - BOT_RX} ${BOT_Y} A${BOT_RX} ${BOT_RY} 0 0 0 ${50 + BOT_RX} ${BOT_Y} L${50 + RIM_RX} ${RIM_Y}`, ' stroke-linejoin="round"'));
  p.push(S('#9CC0D3', 1, `M${r1(wallX(128))} 128 A${r1(50 - wallX(128))} ${BOT_RY} 0 0 0 ${r1(100 - wallX(128))} 128`, ' stroke-opacity=".7"'));
  if (c.sealed) {
    // printed film: paper base with a soft dome light, red ring print, gold 250, a crimped rim
    const film = ell(50, RIM_Y, RIM_RX, RIM_RY);
    p.push(P(PAPER, film, ` stroke="${line(PAPER, 0.45)}" stroke-width="1.6"`) + over(film, G.top));
    p.push(S(GUN, 1.6, ell(50, RIM_Y, 29, 9)));
    p.push(`<text x="50" y="${RIM_Y + 3}" ${FONT_NUM} font-size="11" text-anchor="middle" fill="${GUN}" transform="translate(0 ${r1(RIM_Y * 0.36)}) scale(1 .64)" textLength="24">250</text>`);
    p.push(S('#FFFFFF', 2, `M${50 - RIM_RX + 8} ${RIM_Y - 3} Q30 ${RIM_Y - 11} 46 ${RIM_Y - 12.4}`, ' stroke-linecap="round" stroke-opacity=".9"'));
    p.push(S(PAPER_SH, 1.2, ell(50, RIM_Y, RIM_RX - 2.4, RIM_RY - 1.6), ' stroke-dasharray="1.6 1.6"'));
  } else {
    p.push(S('#A9CADB', 1.2, `M${50 - RIM_RX} ${RIM_Y} A${RIM_RX} ${RIM_RY} 0 0 1 ${50 + RIM_RX} ${RIM_Y}`));
    p.push(S('#7FA6BC', 1.6, `M${50 - RIM_RX} ${RIM_Y} A${RIM_RX} ${RIM_RY} 0 0 0 ${50 + RIM_RX} ${RIM_Y}`));
    p.push(S('#FFFFFF', 1.4, `M${50 - RIM_RX + 6} ${RIM_Y + 6} Q26 ${RIM_Y + 11} 38 ${RIM_Y + 13}`, ' stroke-opacity=".85" stroke-linecap="round"'));
  }
  return svg('as-cup', '0 0 100 150', p.join(''), ` data-tea="${c.tea || ''}" data-sealed="${c.sealed ? 1 : 0}"`);
}

// ─── Stations ──────────────────────────────────────────────────────────────────────────────────
const STEEL_LINE = line(STEEL, 0.5);
// a vertical cylinder seen from above: body from top y0 to bottom y1 between x0..x1, with its top ellipse ry
function cylinder(x0, x1, y0, y1, ry, fill = G.steel, stroke = STEEL_LINE) {
  const rx = (x1 - x0) / 2;
  const d = `M${x0} ${y0} V${y1} A${r1(rx)} ${ry} 0 0 0 ${x1} ${y1} V${y0} Z`;
  return P(fill, d, ` stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"`) + (fill.startsWith('url') ? '' : over(d, G.cyl));
}

export function teaTankSVG(kind = 'black', { fast = false } = {}) {
  const k = TEA_KINDS.includes(kind) ? kind : 'black';
  const t = TEA_COLORS[k];
  const long = t.name.length > 2;
  const band = 'M16 52 A34 11 0 0 0 84 52 L84 76 A34 11 0 0 1 16 76 Z';
  const p = [
    cast(50, 146, 42, 8), ao(50, 146, 42, 8),
    P(STEEL_LO, ell(50, 136, 28, 8)),
    cylinder(16, 84, 34, 124, 11),
    // the label band wrapped round the tank
    P(t.label, band, ` stroke="${line(t.label, 0.4)}" stroke-width="1"`), over(band, G.cyl),
    label(long ? 48 : 49, long ? 70 : 72, t.name, long ? 11 : 16, PAPER, long ? ' textLength="44" lengthAdjust="spacingAndGlyphs"' : ''),
    k === 'jade' ? P(LEMON, ring(76, 64, 4), ' stroke="#E2A800" stroke-width="1"') : P(k === 'green' ? '#BFE38A' : '#E7B98A', 'M72 64 Q72 55 80 54 Q80 63 72 64 Z'),
    // sight glass with the tea level
    P(NIGHT_700, 'M45 84 h10 v28 h-10 Z', ` stroke="${STEEL_LINE}" stroke-width="1"`),
    P(t.body, 'M46.2 90 h7.6 v20.8 h-7.6 Z'), P('#FFFFFF', 'M47 91 h1.8 v19 h-1.8 Z', ' fill-opacity=".6"'),
    // the lid: we look onto it from above
    P(G.steelTop, ell(50, 34, 34, 11), ` stroke="${STEEL_LINE}" stroke-width="1.2"`),
    P(lit(STEEL, 0.4), ell(50, 32, 25, 7.6)), over(ell(50, 32, 25, 7.6), G.top),
    S('#FFFFFF', 1.6, 'M24 30 Q34 24 48 23.4', ' stroke-linecap="round" stroke-opacity=".9"'),
    P(G.chrome, 'M45 26 h10 v-5 a5 2 0 0 0 -10 0 Z', ` stroke="${STEEL_LINE}" stroke-width="1"`), P(G.steelTop, ell(50, 21, 5, 2)),
    // the tap at the front: block, spout, red lever
    P(G.steel, 'M41 114 H59 V124 H55 V132 Q55 134 53 134 H47 Q45 134 45 132 V124 H41 Z', ` stroke="${STEEL_LINE}" stroke-width="1.2" stroke-linejoin="round"`),
    P(GUN, 'M57 116 L70 104 Q73 102 74.5 105 Q75 107 73 109 L60 120 Z', ` stroke="${GUN_DEEP}" stroke-width="1.2" stroke-linejoin="round"`),
    over('M57 116 L70 104 Q73 102 74.5 105 Q75 107 73 109 L60 120 Z', G.box),
    P(t.body, 'M48 134 h4 l-.6 3.4 a1.4 1.4 0 0 1 -2.8 0 Z'),
    fast ? P(G.chrome, 'M26 114 H38 V125 H34 V131 H30 V125 H26 Z', ` stroke="${STEEL_LINE}" stroke-width="1.1"`) + P(t.body, 'M30.6 131 h2.8 l-.4 3 a1.1 1.1 0 0 1 -2 0 Z') +
      P(LEMON, 'M30 84 L24 98 H30 L27 110 L38 94 H32 L36 84 Z', ` stroke="${TAKE_DEEP}" stroke-width="1.1" stroke-linejoin="round"`) : '',
  ];
  return svg('as-station as-tank', '0 0 100 155', p.join(''), ` data-kind="${k}" data-fast="${fast ? 1 : 0}"`);
}

// A steel hotel pan seen from above (rim back edge y 16, front edge y 60, front face to y 74). inner(yFloorBack) draws the
// contents on the floor; `name` goes on a paper tag on the front face.
const PAN_RIM = 'M10 16 H90 L97 60 H3 Z';
const PAN_IN = 'M14 20 H86 L92 56 H8 Z';
const PAN_FLOOR = 'M18 31 H82 L88 55 H12 Z';
function panShell(contents, name, tone = STEEL_LO) {
  return [
    ao(50, 76, 52, 10),
    P(G.steelTop, PAN_RIM, ` stroke="${STEEL_LINE}" stroke-width="1.2" stroke-linejoin="round"`),
    P(dark(tone, 0.1), PAN_IN),
    P(lit(STEEL, 0.15), 'M14 20 H86 L82 31 H18 Z'), over('M14 20 H86 L82 31 H18 Z', G.front),   // the lit back wall inside
    P(tone, PAN_FLOOR),
    contents,
    over(PAN_IN, G.inner),
    S('#FFFFFF', 1.6, 'M12 17.6 H88', ' stroke-opacity=".85" stroke-linecap="round"'),
    P(G.steel, 'M3 60 H97 L95 74 H5 Z', ` stroke="${STEEL_LINE}" stroke-width="1.1" stroke-linejoin="round"`), over('M3 60 H97 L95 74 H5 Z', G.front),
    name ? P(PAPER, 'M33 62.4 H67 V72 H33 Z', ` stroke="${line(PAPER, 0.4)}" stroke-width=".8"`) + label(50, 70.2, name, 7.6) : '',
  ].join('');
}

// Items scattered over the pan floor (back edge yT .. front 55), in perspective (smaller at the back), n items.
function trayItems(kind, n, yT, seed) {
  const rnd = mulberry32(seed);
  const items = [];
  const rows = Math.max(1, Math.round((55 - yT) / 6));
  const per = Math.ceil(n / rows);
  let left = n;
  for (let r = 0; r < rows && left > 0; r++) {
    const y = 52 - (r * (52 - yT - 3)) / Math.max(1, rows - 1);
    const k = 0.72 + 0.28 * ((y - 20) / 36);
    const xa = 12 - ((y - 31) / 24) * 6 + 4;
    const cnt = Math.min(per, left);
    for (let i = 0; i < cnt; i++) {
      const x = xa + ((100 - 2 * xa) * (i + 0.5 + (r % 2) * 0.3)) / cnt;
      items.push([r1(x + (rnd() - 0.5) * 2), r1(y + (rnd() - 0.5) * 1.6), (rnd() - 0.5) * 40, k]);
    }
    left -= cnt;
  }
  items.reverse(); // back rows first
  if (kind === 'pearl' || kind === 'bean') {
    const bean = kind === 'bean';
    return P(bean ? BEAN : PEARL, items.map(([x, y, , k]) => (bean ? ell(x, y, 3.2 * k, 2.2 * k) : ring(x, y, r1(3.2 * k)))).join(' '), ` stroke="${bean ? '#4A1714' : '#140A06'}" stroke-width=".5"`) +
      P('#FFFFFF', items.map(([x, y, , k]) => ring(r1(x - 1 * k), r1(y - 1.1 * k), r1(0.8 * k))).join(' '), ' fill-opacity=".8"');
  }
  if (kind === 'taro') {
    return TARO.map((c, j) => P(c, items.filter((_, i) => i % 3 === j).map(([x, y, , k]) => `M${r1(x - 3.4 * k)} ${r1(y - 2 * k)} h${r1(6.8 * k)} v${r1(4 * k)} h${r1(-6.8 * k)} Z`).join(' ') || 'M0 0', ` stroke="${line(c, 0.4)}" stroke-width=".6" stroke-linejoin="round"`)).join('');
  }
  if (kind === 'coconut') {
    return P(COCO, items.map(([x, y, a, k]) => sq(x, y, r1(5.2 * k), a, 0.75)).join(' '), ' fill-opacity=".92" stroke="#B9A673" stroke-width=".6" stroke-linejoin="round"') +
      P('#FFFFFF', items.map(([x, y, a, k]) => sq(r1(x - 1), r1(y - 0.8), r1(1.8 * k), a, 0.75)).join(' '), ' fill-opacity=".85"');
  }
  if (kind === 'pudding') {
    return P(PUDDING, items.map(([x, y, , k]) => `M${r1(x - 3.4 * k)} ${r1(y + 2.4 * k)} L${r1(x - 2.6 * k)} ${r1(y - 2.2 * k)} H${r1(x + 2.6 * k)} L${r1(x + 3.4 * k)} ${r1(y + 2.4 * k)} Z`).join(' '), ' stroke="#B8801E" stroke-width=".6" stroke-linejoin="round"') +
      P(CARAMEL, items.map(([x, y, , k]) => `M${r1(x - 2.6 * k)} ${r1(y - 2.2 * k)} H${r1(x + 2.6 * k)} L${r1(x + 2.8 * k)} ${r1(y - 0.6 * k)} H${r1(x - 2.8 * k)} Z`).join(' '));
  }
  return P(GRASS, items.map(([x, y, a, k]) => sq(x, y, r1(5.6 * k), a * 0.6, 0.75)).join(' '), ' stroke="#121208" stroke-width=".5" stroke-linejoin="round"') +
    S(GRASS_HI, 1, items.map(([x, y, , k]) => `M${r1(x - 2 * k)} ${r1(y - 0.8 * k)} l1.6 -1.2`).join(' '), ' stroke-linecap="round"');
}

const TRAY_BASE = { pearl: '#4A2A1A', coconut: '#E9DDB0', pudding: '#E8AE45', grass: '#1E1F16', taro: '#E8D7C2', bean: '#5E1E1A' };

export function toppingTraySVG(kind = 'pearl', scoopsLeft = 10) {
  const k = TOPPING_KINDS.includes(kind) ? kind : 'pearl';
  const left = int(scoopsLeft, 0, 10, 10);
  const f = left / 10;
  let inner = '';
  if (left > 0) {
    const yT = r1(44 - f * 16); // the pile's back edge rises as the pan fills
    const xT = r1(18 - ((yT - 31) / 24) * 6);
    const pile = `M${xT} ${yT} Q50 ${r1(yT - 3)} ${r1(100 - xT)} ${yT} L88 55 H12 Z`;
    inner += P(TRAY_BASE[k], pile) + over(pile, G.top, 0.6);
    inner += trayItems(k, 8 + Math.round(f * 18), yT, fnv1a(k + left));
  } else {
    inner += S(STEEL_HI, 1.2, 'M26 46 L32 38 M34 48 L42 38', ' stroke-opacity=".7" stroke-linecap="round"');
  }
  // a long-handled scoop resting in the pan
  inner += S(dark(STEEL, 0.35), 3.6, 'M70 42 L88 6', ' stroke-linecap="round"') + S(STEEL_HI, 1.6, 'M70 42 L88 6', ' stroke-linecap="round"') +
    P(G.steelTop, ell(68, 45, 7, 3.6), ` stroke="${STEEL_LINE}" stroke-width="1"`);
  return svg('as-station as-tray', '0 0 100 95', panShell(inner, TOPPING_NAME[k]), ` data-kind="${k}" data-left="${left}"`);
}

/** The lemon tray: a small pan of lemon wheels (slices of max). */
export function lemonTraySVG(slices = 6, max = 6) {
  const n = max > 0 ? Math.round((clamp(slices, 0, max) / max) * 8) : 0;
  const pos = [[30, 49], [50, 50], [70, 49], [40, 42], [60, 42], [28, 36], [50, 35], [72, 36]].slice(0, n).reverse();
  let inner = P('#F6E7A8', PAN_FLOOR, ' fill-opacity=".5"');
  for (const [x, y] of pos) {
    const k = 0.75 + 0.25 * ((y - 31) / 24);
    inner += P('#E2A800', ell(x, y + 1, 10 * k, 5 * k)) + P('#FFF6C8', ell(x, y, 9 * k, 4.2 * k)) + P(LEMON, ell(x, y, 7.4 * k, 3.4 * k)) +
      S('#FFF6C8', 0.8, `M${r1(x - 7 * k)} ${y} H${r1(x + 7 * k)} M${x} ${r1(y - 3.2 * k)} V${r1(y + 3.2 * k)}`);
  }
  if (!n) inner += S(STEEL_HI, 1.2, 'M26 46 L32 38 M34 48 L42 38', ' stroke-opacity=".7" stroke-linecap="round"');
  return svg('as-station as-tray as-lemon', '0 0 100 95', panShell(inner, ''), ` data-left="${clamp(slices, 0, max)}"`);
}

export function iceBinSVG() {
  const cubes = [];
  const rnd = mulberry32(250);
  for (let r = 0; r < 3; r++) {
    const y = 51 - r * 7.6;
    const xa = 14 + r * 3;
    for (let x = xa + 6; x < 100 - xa - 4; x += 10) cubes.push([r1(x + (r % 2) * 4 + (rnd() - 0.5) * 2), r1(y + (rnd() - 0.5) * 1.6), (rnd() - 0.5) * 50, 0.78 + 0.22 * ((y - 31) / 24)]);
  }
  cubes.reverse();
  const inner = P('#CFE7F4', PAN_FLOOR) +
    P(ICE_EDGE, cubes.map(([x, y, , k]) => `M${r1(x - 4 * k)} ${r1(y + 2 * k)} h${r1(8 * k)} v${r1(3 * k)} h${r1(-8 * k)} Z`).join(' '), ' fill-opacity=".5"') +
    P(ICE, cubes.map(([x, y, a, k]) => sq(x, y, r1(8.6 * k), a, 0.6)).join(' '), ` stroke="${ICE_EDGE}" stroke-width=".8" stroke-linejoin="round"`) +
    P('#FFFFFF', cubes.map(([x, y, a, k]) => sq(r1(x - 1.6 * k), r1(y - 1), r1(3 * k), a, 0.6)).join(' ')) +
    P(G.steelTop, 'M58 40 L74 34 Q80 37 78 42 L64 46 Q58 45 58 40 Z', ` stroke="${STEEL_LINE}" stroke-width="1"`) +
    S(COUNTER, 3.2, 'M77 37 L90 28', ' stroke-linecap="round"');
  return svg('as-station as-ice', '0 0 100 95', panShell(inner, '冰塊'));
}

export function iceDispenserSVG() {
  const top = 'M10 8 H90 L95 22 H5 Z';
  const front = 'M5 22 H95 V82 H5 Z';
  const p = [
    ao(50, 86, 50, 8),
    P(G.steel, front, ` stroke="${STEEL_LINE}" stroke-width="1.2"`), over(front, G.front),
    P(G.steelTop, top, ` stroke="${STEEL_LINE}" stroke-width="1.2" stroke-linejoin="round"`),
    P('#CFE7F4', 'M12 28 H66 V52 H12 Z', ` stroke="${STEEL_LINE}" stroke-width="1"`),
    P(ICE, [[20, 46], [30, 42], [42, 47], [54, 43], [26, 35], [48, 34], [60, 49]].map(([x, y], i) => sq(x, y, 8, i * 17, 0.8)).join(' '), ` stroke="${ICE_EDGE}" stroke-width=".8"`),
    over('M12 28 H66 V52 H12 Z', G.glass),
    P(NIGHT_700, 'M28 58 H52 V68 H46 L42 76 H38 L34 68 H28 Z'),
    P(COUNTER, 'M72 30 H88 V74 H72 Z'), P('#7FD4FF', `${ring(80, 40, 2.4)} ${ring(80, 50, 2.4)} ${ring(80, 60, 2.4)}`),
    S('#FFFFFF', 1.4, 'M12 9.6 H88', ' stroke-opacity=".8"'),
  ];
  return svg('as-station as-ice as-dispenser', '0 0 100 95', p.join(''));
}

export function syrupSVG() {
  const p = [
    cast(35, 102, 30, 6), ao(35, 102, 30, 6),
    cylinder(12, 58, 42, 94, 7, '#FFF4DD', line(SYRUP, 0.4)),
    P(SYRUP, 'M14 56 V93 A21 6 0 0 0 56 93 V56 Z'), over('M14 56 V93 A21 6 0 0 0 56 93 V56 Z', G.cyl),
    P(celHilite(SYRUP), ell(35, 56, 21, 5)),
    P(PAPER, 'M14 66 A21 6 0 0 0 56 66 V82 A21 6 0 0 1 14 82 Z', ` stroke="${line(PAPER, 0.4)}" stroke-width=".8"`),
    label(35, 81, '果糖', 12),
    over('M12 42 V94 A23 7 0 0 0 58 94 V42 Z', G.glass, 0.7),
    P(G.steelTop, ell(35, 42, 23, 7), ` stroke="${line(SYRUP, 0.4)}" stroke-width="1"`),
    // the pump head seen from above: collar, stem, head, nozzle
    P(COUNTER, 'M27 40 V32 A8 3 0 0 1 43 32 V40 A8 3 0 0 1 27 40 Z'), P(lit(COUNTER, 0.3), ell(35, 32, 8, 3)),
    P(G.chrome, 'M33 32 V20 h4 V32 Z'),
    P(COUNTER, 'M24 20 Q24 13 35 13 Q46 13 46 20 Q46 24 35 24 Q24 24 24 20 Z'), P(lit(COUNTER, 0.35), ell(35, 17.6, 9, 3.4)),
    P(COUNTER, 'M44 16 H60 Q63 16 63 19 V22 H59 V20 H44 Z'), P(SYRUP, 'M59 22 h3 v2 a1.5 2 0 0 1 -3 0 Z'),
  ];
  return svg('as-station as-syrup', '0 0 70 108', p.join(''));
}

export function sealerSVG(state = 'idle', { turbo = false } = {}) {
  const busy = state === 'busy';
  const dy = busy ? 16 : 0;
  const red = 'M10 30 H100 V62 Q100 66 96 66 H14 Q10 66 10 62 Z';
  const redTop = 'M16 18 H94 L100 30 H10 Z';
  const p = [
    cast(55, 146, 54, 8), ao(55, 146, 54, 8),
    // base: top face + front face, the cup platform
    P(G.steelTop, 'M10 122 H100 L106 138 H4 Z', ` stroke="${STEEL_LINE}" stroke-width="1.2" stroke-linejoin="round"`),
    P(G.steel, 'M4 138 H106 L104 146 H6 Z', ` stroke="${STEEL_LINE}" stroke-width="1"`),
    P(dark(STEEL, 0.25), ell(55, 132, 27, 7.5)), P(STEEL_LO, ell(55, 132, 22, 6)), over(ell(55, 132, 22, 6), G.inner),
    // the column at the back
    cylinder(80, 94, 50, 126, 3),
    // film roll lying on top of the housing
    P(PAPER, 'M24 6 H84 Q88 6 88 12 Q88 18 84 18 H24 Z', ` stroke="${line(PAPER, 0.45)}" stroke-width="1"`),
    `<path fill="url(#gkChrome)" fill-opacity=".35" d="M24 6 H84 Q88 6 88 12 Q88 18 84 18 H24 Z"/>`,
    S(GUN, 2.2, 'M28 12 H82', ' stroke-dasharray="3 5"'),
    P(PAPER_SH, ell(24, 12, 3.6, 6), ` stroke="${line(PAPER, 0.45)}" stroke-width="1"`),
    // red housing: top face catches the light, front face falls off
    P(lit(GUN, 0.18), redTop, ` stroke="${GUN_DEEP}" stroke-width="1.1" stroke-linejoin="round"`), over(redTop, G.top),
    P(GUN, red, ` stroke="${GUN_DEEP}" stroke-width="1.1"`), over(red, G.front),
    P(G.steelTop, 'M20 36 H60 V54 H20 Z', ` stroke="${GUN_DEEP}" stroke-width="1"`),
    `<text x="40" y="50" ${FONT_NUM} font-size="13" text-anchor="middle" fill="${GUN}">250</text>`,
    P(busy ? TAKE : MINT, ring(74, 44, 4), ` stroke="${dark(busy ? TAKE : MINT, 0.4)}" stroke-width="1"`), P('#FFFFFF', ring(72.6, 42.6, 1.3), ' fill-opacity=".8"'),
    S(PAPER, 3, 'M30 18 V30', ' stroke-opacity=".85"'),
    // the press head (moves down when busy) + the lever
    `<g class="as-sealer-head" transform="translate(0 ${dy})">` +
      P(G.chrome, 'M49 66 h12 v18 h-12 Z', ` stroke="${STEEL_LINE}" stroke-width="1"`) +
      P(G.steel, 'M27 84 H83 L80 94 H30 Z', ` stroke="${STEEL_LINE}" stroke-width="1.1" stroke-linejoin="round"`) +
      P(G.steelTop, ell(55, 84, 28, 5)) +
      (busy ? P(TAKE, ell(55, 96, 30, 5), ' fill-opacity=".35"') + P(GOLD_HI, ell(55, 95, 22, 2.4), ' fill-opacity=".8"') : '') +
    '</g>',
    `<g class="as-sealer-lever" transform="rotate(${busy ? 24 : 0} 96 44)">${S(dark(STEEL, 0.4), 4.4, 'M96 44 L108 16', ' stroke-linecap="round"')}${S(STEEL_HI, 2, 'M96 44 L108 16', ' stroke-linecap="round"')}` +
      `${P(GUN, ring(108, 14, 5.4), ` stroke="${GUN_DEEP}" stroke-width="1"`)}${over(ring(108, 14, 5.4), G.sph)}</g>`,
    turbo ? P(LEMON, 'M10 52 H100 V57 H10 Z', ` stroke="${TAKE_DEEP}" stroke-width=".8"`) + P(LEMON, 'M68 32 L62 44 H68 L65 54 L76 40 H70 L74 32 Z', ` stroke="${TAKE_DEEP}" stroke-width="1.1" stroke-linejoin="round"`) : '',
  ];
  return svg('as-station as-sealer', '0 0 110 150', p.join(''), ` data-state="${busy ? 'busy' : 'idle'}" data-turbo="${turbo ? 1 : 0}"`);
}

export function potSVG(opts = {}) {
  const scoops = int(opts.scoops, 0, 10, 0);
  const pct = clamp(Number(opts.cookingPct ?? 1) || 0, 0, 1);
  const cooking = pct < 1;
  const bodyD = 'M8 38 V82 A47 15 0 0 0 102 82 V38 Z';
  const p = [cast(55, 96, 54, 9), ao(55, 96, 54, 9)];
  // handles (loops at the sides)
  p.push(S(dark(COUNTER, 0.2), 6, 'M10 50 H2 M100 50 H108', ' stroke-linecap="round"') + S(lit(COUNTER, 0.3), 2, 'M10 48.6 H3 M100 48.6 H107', ' stroke-linecap="round"'));
  p.push(P(G.steel, bodyD, ` stroke="${STEEL_LINE}" stroke-width="1.2"`));
  p.push(S('#FFFFFF', 3, 'M16 46 V84', ' stroke-opacity=".55" stroke-linecap="round"'));
  // the rim and the inside: we look into the pot
  p.push(P(G.steelTop, ell(55, 38, 47, 17), ` stroke="${STEEL_LINE}" stroke-width="1.2"`));
  p.push(P(dark(STEEL_LO, 0.25), ell(55, 39, 42, 14.6)));
  const n = cooking ? 16 : Math.round(scoops * 2.6);
  if (cooking || scoops > 0) {
    p.push(P(cooking ? '#8C6A4E' : '#6E3C20', ell(55, 42, 39, 12.4)));
    const rnd = mulberry32(fnv1a(`pot${scoops}${cooking}`));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd());
      pts.push([r1(55 + Math.cos(a) * rr * 32), r1(42.5 + Math.sin(a) * rr * 9)]);
    }
    pts.sort((a, b) => a[1] - b[1]);
    if (pts.length) {
      p.push(P(cooking ? '#C9A27E' : PEARL, pts.map(([x, y]) => ring(x, y, 3.4)).join(' '), ` stroke="${cooking ? '#6B4A30' : '#140A06'}" stroke-width=".5"`));
      p.push(P('#FFFFFF', pts.map(([x, y]) => ring(r1(x - 1), r1(y - 1.1), 0.9)).join(' '), ` fill-opacity="${cooking ? 0.45 : 0.85}"`));
    }
    if (cooking) p.push(S('#F3E2CC', 1.1, `${ring(36, 40, 2.4)} ${ring(70, 45, 3)} ${ring(58, 38, 1.8)} ${ring(46, 46, 1.6)}`));
  }
  p.push(over(ell(55, 39, 42, 14.6), G.inner));
  p.push(S('#FFFFFF', 1.8, 'M18 33 Q34 24 54 22.6', ' stroke-linecap="round" stroke-opacity=".9"'));
  if (cooking) {
    p.push(`<path class="as-pot-steam" fill="none" stroke="${PAPER}" stroke-width="3" stroke-linecap="round" stroke-opacity=".75" d="M38 30 q-5 -7 0 -14 q5 -7 0 -14 M58 26 q-5 -7 0 -14 q5 -7 0 -14 M74 30 q-4 -6 0 -11"/>`);
    p.push(`<circle cx="94" cy="12" r="11" fill="${NIGHT_700}" stroke="${INK_BG}" stroke-width="1.4"/>`);
    p.push(`<circle class="as-pot-timer" cx="94" cy="12" r="7.6" fill="none" stroke="${TAKE}" stroke-width="3.4" pathLength="100" stroke-dasharray="${r1(pct * 100)} 100" transform="rotate(-90 94 12)"/>`);
  }
  return svg('as-station as-pot', '0 0 110 105', p.join(''), ` data-scoops="${scoops}" data-cooking="${cooking ? 1 : 0}"`);
}

export function potRigSVG(lv = 1) {
  const p = [];
  if (lv >= 3) {
    let fl = '';
    let core = '';
    for (let i = 0; i < 8; i++) {
      const x = 18 + i * 10.6;
      fl += `M${r1(x - 5)} 104 Q${r1(x - 4)} 93 ${r1(x)} 87 Q${r1(x + 4)} 93 ${r1(x + 5)} 104 Z `;
      core += `M${r1(x - 2.4)} 104 Q${r1(x - 2)} 98 ${r1(x)} 95 Q${r1(x + 2)} 98 ${r1(x + 2.4)} 104 Z `;
    }
    p.push(P(COUNTER_LO, ell(55, 104, 50, 8)) + P(TAKE, fl) + P('#7FD4FF', core));
  }
  if (lv >= 4) {
    p.push(P(G.steel, 'M0 -46 H40 L28 -12 H12 Z', ` stroke="${STEEL_LINE}" stroke-width="1.2"`) + P(G.steelTop, ell(20, -46, 20, 5)));
    p.push(P(PEARL, `${ring(11, -46, 3.4)} ${ring(20, -47, 3.4)} ${ring(29, -46, 3.4)} ${ring(16, -44, 3)} ${ring(25, -44, 3)}`));
    p.push(S(dark(STEEL, 0.4), 7, 'M20 -12 V6 Q20 20 34 26', ' stroke-linecap="round"') + S(STEEL_HI, 3.4, 'M20 -12 V6 Q20 20 34 26', ' stroke-linecap="round"'));
    p.push(P(MINT, ring(32, -22, 3.4), ` stroke="${dark(MINT, 0.4)}" stroke-width="1"`));
  }
  return svg('as-pot-rig', '0 0 110 105', p.join(''), ` data-lv="${int(lv, 1, 4, 1)}"`);
}

export function cupRackSVG() {
  // three stacks of nested clear cups on a steel stand, seen from above: the top cup's mouth, rims stepping down
  const stacks = [[24, 34], [52, 26], [78, 38]];
  let fill = '';
  let rims = '';
  let outline = '';
  let mouths = '';
  for (const [cx, top] of stacks) {
    const hw = 14;
    fill += `M${cx - hw} ${top} L${cx - 9} 104 A9 3 0 0 0 ${cx + 9} 104 L${cx + hw} ${top} Z `;
    outline += `M${cx - hw} ${top} L${cx - 9} 104 M${cx + hw} ${top} L${cx + 9} 104 `;
    for (let y = top + 6; y < top + 36; y += 5) rims += `M${cx - hw + 0.4} ${y} A${hw} 3.6 0 0 0 ${cx + hw - 0.4} ${y} `;
    mouths += ell(cx, top, hw, 4.6) + ' ';
  }
  const p = [
    cast(50, 116, 52, 8), ao(50, 116, 52, 8),
    P(G.steelTop, 'M6 102 H94 L98 112 H2 Z', ` stroke="${STEEL_LINE}" stroke-width="1.1"`), P(G.steel, 'M2 112 H98 L97 118 H3 Z'),
    P('#DDEFF7', fill, ' fill-opacity=".42"'),
    over(fill, G.glass),
    S('#9FC4D8', 1, rims),
    P('#EAF6FB', mouths, ' fill-opacity=".75"'), S('#7FA6BC', 1.1, mouths),
    S('#7FA6BC', 1.1, outline),
  ];
  return svg('as-station as-rack', '0 0 100 125', p.join(''));
}

export function trashSVG() {
  const bodyD = 'M12 32 L18 96 A22 7 0 0 0 62 96 L68 32 Z';
  const p = [
    cast(40, 102, 34, 6), ao(40, 102, 34, 6),
    // the lid flipped up behind the opening
    `<g transform="rotate(-18 14 26)">${P(NIGHT_700, 'M12 6 Q12 2 16 2 H64 Q68 2 68 6 V22 H12 Z', ` stroke="${line(NIGHT_700, 0.3)}" stroke-width="1"`)}${over('M12 6 Q12 2 16 2 H64 Q68 2 68 6 V22 H12 Z', G.front)}</g>`,
    P(G.steel, bodyD, ` stroke="${STEEL_LINE}" stroke-width="1.2"`),
    P(GUN, 'M13.6 50 L66.4 50 L65.8 58 L14.2 58 Z'), over('M13.6 50 L66.4 50 L65.8 58 L14.2 58 Z', G.cyl),
    P(G.steelTop, ell(40, 32, 28, 9), ` stroke="${STEEL_LINE}" stroke-width="1.1"`),
    P('#2A2030', ell(40, 33, 24, 7)), over(ell(40, 33, 24, 7), G.inner),
    // a crumpled cup peeking out
    P('#DDEFF7', 'M42 30 L48 16 L58 19 L55 31 Z', ' stroke="#7FA6BC" stroke-width="1" stroke-linejoin="round"'), P(GUN, 'M47 18 L57 21 L56 24 L46 21 Z', ' fill-opacity=".7"'),
    P(COUNTER_LO, 'M30 100 H50 L52 106 H28 Z'),
  ];
  return svg('as-station as-trash', '0 0 80 108', p.join(''));
}

export function workSlotSVG() {
  // a stainless cup holder set into the rubber prep mat, seen from above: ring, lip, hole
  const p = [
    ao(50, 32, 48, 13),
    P(G.steelTop, ell(50, 27, 43, 15.5), ` stroke="${STEEL_LINE}" stroke-width="1.1"`),
    P(dark(STEEL, 0.2), ell(50, 26.5, 33, 11)),
    P('#33262A', ell(50, 27.6, 28, 8.6)), over(ell(50, 27.6, 28, 8.6), G.inner),
    S('#FFFFFF', 2, 'M14 22 Q28 13 50 12', ' stroke-linecap="round" stroke-opacity=".9"'),
  ];
  return svg('as-station as-slot', '0 0 100 50', p.join(''));
}

// ─── Order bubbles (icons only): one card per cup ──────────────────────────────────────────────
export const CARD = { w: 62, h: 68 };
const CUP_T = 8;   // rim
const CUP_B = 64;  // base
function cupCard(it, x, y, done) {
  const c = normCup(it);
  const golden = !!(it && it.golden);
  const body = teaColor(c);
  const L = (yy) => r1(x + 2 + ((yy - y - CUP_T) * 5) / (CUP_B - CUP_T));
  const R = (yy) => r1(x + 38 - ((yy - y - CUP_T) * 5) / (CUP_B - CUP_T));
  const cupD = `M${x + 2} ${y + CUP_T} H${x + 38} L${x + 33} ${y + CUP_B} H${x + 7} Z`;
  const p = [P('#E4F3FA', cupD)];
  const surf = y + (c.foam ? 24 : 17);
  const liquid = `M${L(surf)} ${surf} H${R(surf)} L${x + 33} ${y + CUP_B} H${x + 7} Z`;
  if (golden) {
    p.push(P(TAKE, liquid) + P(GOLD_HI, `M${L(surf) + 4} ${surf + 3} h4 l-2 ${CUP_B - 22} h-3 Z`));
    p.push(P(GOLD_HI, `M${x + 48} ${y + 10} l2.6 6.4 6.4 2.6 -6.4 2.6 -2.6 6.4 -2.6 -6.4 -6.4 -2.6 6.4 -2.6 Z M${x + 49} ${y + 38} l1.8 4.4 4.4 1.8 -4.4 1.8 -1.8 4.4 -1.8 -4.4 -4.4 -1.8 4.4 -1.8 Z`, ` stroke="${TAKE_DEEP}" stroke-width="1.2"`));
  } else if (body) {
    p.push(P(body, liquid), over(liquid, G.liquid));
    p.push(P(celHilite(body), `M${L(surf)} ${surf} H${R(surf)} V${surf + 3} H${L(surf + 3)} Z`));
    if (c.milk) {
      // milk tea: a white swirl and a small milk-drop badge on the cup
      p.push(S('#FFFFFF', 2.2, `M${x + 9} ${surf + 10} q6 -5 11 0 t11 0`, ' stroke-linecap="round" stroke-opacity=".85"'));
      p.push(P('#FFFFFF', `M${x + 13} ${surf + 14} q-5 7 0 9.4 q5 -2.4 0 -9.4 Z`, ` stroke="#6E9FC0" stroke-width="1.2"`));
    }
  }
  if (c.foam && !golden) {
    // cheese foam cap: a thick cream layer at the top with a little cheese wedge
    p.push(P(FOAM, `M${L(y + 11)} ${y + 11} H${R(y + 11)} L${R(surf)} ${surf} H${L(surf)} Z`, ` stroke="#D9B66A" stroke-width="1"`));
    p.push(P('#FFFFFF', `M${x + 8} ${y + 12} q12 -6 24 0 Z`));
    p.push(P('#F7C948', `M${x + 25} ${y + 15} l7 -2 v5 Z`, ` stroke="${TAKE_DEEP}" stroke-width=".9" stroke-linejoin="round"`));
  }
  if (!golden) {
    c.toppings.forEach((k, i) => {
      const yB = y + CUP_B - 1.5 - i * 12;
      const cy = yB - 5.6;
      const xs = [x + 12, x + 20, x + 28];
      if (k === 'pearl' || k === 'bean') {
        const bean = k === 'bean';
        p.push(P(bean ? BEAN : PEARL, xs.map((cx) => (bean ? ell(cx, cy, 4.6, 3.2) : ring(cx, cy, 4.2))).join(' '), ` stroke="${INK}" stroke-width="1"`) +
          P('#FFFFFF', xs.map((cx) => ring(r1(cx - 1.4), r1(cy - 1.4), 1.1)).join(' '), ' fill-opacity=".8"'));
      } else if (k === 'pudding') {
        const yT = yB - 11;
        p.push(P(PUDDING, `M${L(yB) + 2} ${yB} L${L(yT) + 3} ${yT} H${R(yT) - 3} L${R(yB) - 2} ${yB} Z`, ' stroke="#A8701A" stroke-width="1.1" stroke-linejoin="round"') +
          P(CARAMEL, `M${L(yT) + 3} ${yT} H${R(yT) - 3} L${R(yT) - 2.6} ${yT + 3.4} H${L(yT) + 2.6} Z`));
      } else if (k === 'taro') {
        p.push(xs.map((cx, j) => P(TARO[j], `M${cx - 4} ${cy - 3.2} h8 v6.4 h-8 Z`, ` stroke="${INK}" stroke-width="1" stroke-linejoin="round"`)).join(''));
      } else {
        const fill = k === 'grass' ? GRASS : COCO;
        const st = k === 'grass' ? INK : '#9C8A55';
        p.push(P(fill, xs.map((cx, j) => sq(cx, cy, 7.6, (j - 1) * 14)).join(' '), ` stroke="${st}" stroke-width="1" stroke-linejoin="round"`));
      }
    });
  }
  if (c.lemon && !golden) p.push(P(LEMON, ring(x + 9, y + 10, 6.6), ` stroke="#C99400" stroke-width="1.4"`) + S('#FFF6C8', 1, `M${x + 4} ${y + 10} H${x + 14} M${x + 9} ${y + 5} V${y + 15}`));
  p.push(S(INK, 2.2, `${cupD} M${x} ${y + CUP_T} H${x + 40}`, ' stroke-linejoin="round"') +
    S(INK, 2.4, `M${x + 27} ${y + CUP_T} L${x + 32} ${y - 3}`, ' stroke-linecap="round"') +
    P('#FFFFFF', `M${x + 5} ${y + CUP_T + 4} h3 l3 ${CUP_B - CUP_T - 10} h-2.4 Z`, ' fill-opacity=".55"'));
  if (!golden) {
    // the spec column: ice cubes then syrup drops, 15 units apart
    const pips = [...Array(c.ice).fill('i'), ...Array(c.sugar).fill('s')];
    const y0 = y + CUP_T + 6 + (4 - pips.length) * 3.75;
    let ice = '';
    let iceG = '';
    let drop = '';
    let dropG = '';
    pips.forEach((k, i) => {
      const cx = x + 52;
      const cy = r1(y0 + i * 15);
      if (k === 'i') { ice += sq(cx, cy, 13, i % 2 ? 10 : -8) + ' '; iceG += sq(r1(cx - 2.6), r1(cy - 2.6), 4, -8) + ' '; }
      else { drop += `M${cx} ${r1(cy - 8)} Q${cx + 7} ${cy} ${cx + 6} ${r1(cy + 2.6)} A6.2 6.2 0 0 1 ${cx - 6} ${r1(cy + 2.6)} Q${cx - 7} ${cy} ${cx} ${r1(cy - 8)} Z `; dropG += ring(r1(cx - 2), r1(cy + 1.6), 1.4) + ' '; }
    });
    if (ice) p.push(P(ICE, ice, ' stroke="#3E7FA8" stroke-width="1.5" stroke-linejoin="round"') + P('#FFFFFF', iceG));
    if (drop) p.push(P(SYRUP, drop, ` stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"`) + P('#FFFFFF', dropG, ' fill-opacity=".75"'));
  }
  if (done) {
    p.push(P(PAPER, `M${x - 2} ${y - 4} H${x + CARD.w} V${y + CARD.h} H${x - 2} Z`, ' fill-opacity=".66"'));
    p.push(P(MINT, ring(x + 36, y + 44, 11), ` stroke="${INK}" stroke-width="2.2"`) + S(PAPER, 3.6, `M${x + 30.6} ${y + 44} L${x + 34.6} ${y + 48} L${x + 41.6} ${y + 39}`, ' stroke-linecap="round" stroke-linejoin="round"'));
  }
  return p.join('');
}

// the snack card: a red-striped paper bag of golden 雞蛋糕 balls (SNACK_W wide)
const SNACK_W = 34;
function snackCard(x, y, done) {
  const p = [
    P('#F7E9C8', `M${x + 3} ${y + 26} H${x + 31} L${x + 29} ${y + 64} H${x + 5} Z`, ` stroke="${INK}" stroke-width="2" stroke-linejoin="round"`),
    P(GUN, `M${x + 3.6} ${y + 34} H${x + 30.4} L${x + 30.1} ${y + 39} H${x + 3.9} Z M${x + 4.4} ${y + 46} H${x + 29.6} L${x + 29.3} ${y + 51} H${x + 4.7} Z`),
    P('#E9A43B', `${ring(x + 10, y + 24, 6)} ${ring(x + 22, y + 22, 6.4)} ${ring(x + 16, y + 15, 6)}`, ` stroke="${INK}" stroke-width="1.6"`),
    P('#FFE29A', `${ring(x + 8.6, y + 22, 1.8)} ${ring(x + 20.4, y + 20, 2)} ${ring(x + 14.6, y + 13, 1.8)}`),
  ];
  if (done) p.push(P(PAPER, `M${x - 1} ${y - 2} H${x + SNACK_W + 1} V${y + CARD.h} H${x - 1} Z`, ' fill-opacity=".66"') +
    P(MINT, ring(x + 17, y + 44, 9), ` stroke="${INK}" stroke-width="2"`) + S(PAPER, 3, `M${x + 12.6} ${y + 44} L${x + 16} ${y + 47.4} L${x + 21.6} ${y + 40}`, ' stroke-linecap="round" stroke-linejoin="round"'));
  return p.join('');
}
// the shake badge (every drink from day 3): a chrome shaker with motion arcs on a purple disc
function shakeBadge(cx, cy) {
  return P(SHUT, ring(cx, cy, 11.5), ` stroke="${INK}" stroke-width="2"`) +
    P(STEEL_HI, `M${cx - 4} ${cy - 6} H${cx + 4} L${cx + 3} ${cy + 7} H${cx - 3} Z`, ` stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"`) +
    P(GUN, `M${cx - 4.4} ${cy - 8.6} H${cx + 4.4} V${cy - 6} H${cx - 4.4} Z`, ` stroke="${INK}" stroke-width="1.2"`) +
    S(PAPER, 1.6, `M${cx - 8} ${cy - 3} q-2 3 0 6 M${cx + 8} ${cy - 3} q2 3 0 6`, ' stroke-linecap="round"');
}
// the carry bag badge (big orders on a bag day)
function bagBadge(x, y) {
  return P('#C99A62', `M${x} ${y} H${x + 26} L${x + 29} ${y + 28} H${x - 3} Z`, ` stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"`) +
    over(`M${x} ${y} H${x + 26} L${x + 29} ${y + 28} H${x - 3} Z`, G.box) +
    S(INK, 2.2, `M${x + 7} ${y} Q${x + 13} ${y - 12} ${x + 19} ${y}`) + P(PAPER, `M${x + 5} ${y + 9} h16 v6 h-16 Z`, ' fill-opacity=".8"');
}

// The bubble shell: paper panel W × Hp with a centred tail (tip at Hp + 14), a hard paper shadow, and the patience bar
// track + fill at the bottom of the panel (rect.pb-fill, data-w = full width; ui.js sets its width and colour).
const TAIL = 14;
function bubbleShell(W, Hp, fill = PAPER, bar = true) {
  const cx = r1(W / 2);
  const shape = `M14 2 H${W - 14} Q${W - 2} 2 ${W - 2} 14 V${Hp - 14} Q${W - 2} ${Hp} ${W - 14} ${Hp} H${cx + 11} L${cx} ${Hp + TAIL} L${cx - 11} ${Hp} H14 Q2 ${Hp} 2 ${Hp - 14} V14 Q2 2 14 2 Z`;
  const bw = W - 24;
  return P(PAPER_SH, shape, ' transform="translate(0 4)"') + P(fill, shape, ` stroke="${INK}" stroke-width="3" stroke-linejoin="round"`) +
    (bar ? `<rect class="pb-track" x="12" y="${Hp - 14}" width="${bw}" height="8" rx="4" fill="${NIGHT_700}" fill-opacity=".2"/>` +
      `<rect class="pb-fill" x="12" y="${Hp - 14}" width="${bw}" height="8" rx="4" fill="${MINT}" data-w="${bw}"/>` : '');
}
export const BUBBLE_TAIL = TAIL;

export function orderBubbleSVG(order = {}) {
  const count = int(order.count, 1, 99, 1);
  const W = CARD.w + 16;
  const Hp = 6 + CARD.h + 16;
  const parts = [bubbleShell(W, Hp), cupCard(order, 9, 6, false)];
  if (order.shake) parts.push(shakeBadge(4, 6));
  if (count > 1) {
    parts.push(P(GUN, ring(W - 6, 6, 12), ` stroke="${INK}" stroke-width="2.2"`));
    parts.push(`<text x="${W - 6}" y="11" ${FONT_NUM} font-size="14" text-anchor="middle" fill="${PAPER}">×${count}</text>`);
  }
  return svg('as-bubble', `0 0 ${W} ${Hp + TAIL + 4}`, parts.join(''), ` data-count="${count}"`);
}

export function itemsBubbleSVG(order = {}, got = [], { gotSnack = false } = {}) {
  const items = Array.isArray(order.items) ? order.items : [order];
  const n = items.length;
  const snack = !!order.snack;
  const shake = items.some((it) => it && it.shake);
  if (n === 1 && !items[0].golden && !snack) {
    const s = orderBubbleSVG({ ...items[0], count: 1 });
    return got[0] ? s : s;
  }
  const cols = n === 4 ? 2 : n;
  const rows = Math.ceil(n / cols);
  const extra = snack ? SNACK_W + 6 : 0;
  const W = 16 + cols * CARD.w + (cols - 1) * 6 + extra;
  const Hp = 6 + rows * CARD.h + (rows - 1) * 6 + 16;
  const parts = [bubbleShell(W, Hp, n === 1 && items[0].golden && !snack ? GOLD_HI : PAPER)];
  items.forEach((it, i) => parts.push(`<g class="as-item${got[i] ? ' done' : ''}">${cupCard(it, 9 + (i % cols) * (CARD.w + 6), 6 + Math.floor(i / cols) * (CARD.h + 6), !!got[i])}</g>`));
  if (snack) parts.push(`<g class="as-snack${gotSnack ? ' done' : ''}">${snackCard(W - 9 - SNACK_W, 6 + (rows - 1) * (CARD.h + 6) / 2, gotSnack)}</g>`);
  if (shake) parts.push(shakeBadge(5, 5));
  if (order.big) parts.push(bagBadge(W - 24, -10));
  return svg('as-bubble as-items', `0 0 ${W} ${Hp + TAIL + 4}`, parts.join(''), ` data-count="${n}" data-got="${got.filter(Boolean).length}" data-snack="${snack ? 1 : 0}"`);
}

// ─── Coin, patience ring ───────────────────────────────────────────────────────────────────────
export function coinSVG() {
  const body = [
    P(TAKE_DEEP, ring(20, 21.6, 17)),
    P(TAKE, ring(20, 20, 17), ' stroke="#A85F00" stroke-width="2"'),
    S(TAKE_DEEP, 1.4, ring(20, 20, 13)),
    `<text x="20" y="24.4" ${FONT_NUM} font-size="11" text-anchor="middle" fill="#A85F00">NT$</text>`,
    S(GOLD_HI, 2.2, 'M8.6 15 Q11 8.6 18 7', ' stroke-linecap="round"'),
  ];
  return svg('as-coin', '0 0 40 40', body.join(''));
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

export function patienceColor(p) {
  const q = clamp(Number(p) || 0, 0, 1);
  return q >= 0.5 ? mixColor(MINT, TAKE, (q - 0.5) * 2) : mixColor(TAKE, GUN, q * 2);
}

// ─── The old portrait backdrop (art-shop-demo.html only) ────────────────────────────────────────
export function counterBackdropSVG() {
  let grout = '';
  for (let y = 16; y < 150; y += 16) grout += `M-120 ${y} H480 `;
  for (let r = 0; r < 10; r++) { const off = r % 2 ? 12 : 0; for (let x = -120 + off; x < 480; x += 24) grout += `M${x} ${r * 16} v16 `; }
  const body = [
    `<defs><radialGradient id="asBdWall" gradientUnits="userSpaceOnUse" cx="180" cy="30" r="260"><stop offset="0" stop-color="#FBEBD0"/><stop offset=".6" stop-color="#EDCB9A"/><stop offset="1" stop-color="#B98456"/></radialGradient></defs>`,
    `<rect x="-120" y="-200" width="600" height="352" fill="url(#asBdWall)"/>`,
    S('#C9A372', 1.1, grout, ' stroke-opacity=".7"'),
    `<rect x="-120" y="150" width="600" height="16" fill="${STEEL}" stroke="${INK_BG}" stroke-width="1.6"/>`,
    `<rect x="-120" y="166" width="600" height="260" fill="${mixColor(STEEL_LO, COUNTER, 0.6)}"/>`,
  ];
  return `<svg class="as-backdrop" viewBox="0 0 360 300" preserveAspectRatio="xMidYMid slice" overflow="visible" aria-hidden="true">${body.join('')}</svg>`;
}

// ─── The landscape work table, seen from above (design y − 284) ────────────────────────────────
const WOOD = '#C98A4B';
const WOOD_HI = '#E6B373';
const WOOD_LO = '#8E5A2E';
const MAT = '#9C5B45';
const MAT_HI = '#BC7A5E';
const MAT_LO = '#6B3A2B';
const TILE = '#F3E4C8';
const TILE_LINE = '#D3BB93';
// table space: back wall 0–34, the back bench 34–150 (its raised wood nosing 150–166), the worktop 166–420, the front
// edge 420–436. Perspective: the table's side edges lean in toward the back (x at y: 34 → 64 px in, 420 → 0) and the
// steel panel seams run toward a vanishing point high above the middle of the table.
const EDGE = (y) => r1(64 * (1 - (y - 34) / 386));
const seamX = (xf, y) => r1(640 + (xf - 640) * (1 - (0.1 * (420 - y)) / 386));

function brush(y0, y1, n, seed) {
  // brushed-steel streaks that follow the perspective (shorter and closer together at the back)
  const rnd = mulberry32(seed);
  let d = '';
  for (let i = 0; i < n; i++) {
    const y = r1(y0 + (rnd() ** 1.4) * (y1 - y0));
    const k = 0.6 + 0.4 * ((y - 34) / 386);
    const a = r1(EDGE(y) + rnd() * (1280 - 2 * EDGE(y)) * 0.85);
    d += `M${a} ${y} h${r1((60 + rnd() * 240) * k)} `;
  }
  return d;
}

function lockBadge(cx, cy, r = 14) {
  const k = r / 14;
  return `<g class="lk">${P(COUNTER, ring(cx, cy, r), ` stroke="${INK}" stroke-width="${r1(2.2 * k)}"`)}${over(ring(cx, cy, r), G.sph, 0.6)}` +
    S(LEMON, r1(3 * k), `M${r1(cx - 4.6 * k)} ${r1(cy - 1 * k)} V${r1(cy - 4.6 * k)} A${r1(4.6 * k)} ${r1(4.6 * k)} 0 0 1 ${r1(cx + 4.6 * k)} ${r1(cy - 4.6 * k)} V${r1(cy - 1 * k)}`, ' stroke-linecap="round"') +
    P(TAKE, `M${r1(cx - 7.4 * k)} ${r1(cy - 1.6 * k)} H${r1(cx + 7.4 * k)} V${r1(cy + 7.6 * k)} H${r1(cx - 7.4 * k)} Z`, ` stroke="${INK}" stroke-width="${r1(1.4 * k)}"`) +
    P(INK, ring(cx, r1(cy + 2.4 * k), r1(1.7 * k))) + '</g>';
}
export function lockBadgeSVG() { return svg('as-lock', '0 0 40 40', lockBadge(20, 20, 17)); }

export function tableSVG() {
  const T = (y) => EDGE(y);
  // the back wall: warm tiles with a sticker wall (pictures only), grout in perspective-free rows
  let grout = '';
  for (let y = 11; y < 34; y += 11) grout += `M0 ${y} H1280 `;
  for (let r = 0; r < 3; r++) { const off = r % 2 ? 13 : 0; for (let x = off; x < 1280; x += 26) grout += `M${x} ${r * 11} v11 `; }
  const rnd = mulberry32(fnv1a('stickers'));
  const STICK = [GUN, SHUT, TAKE, MINT, '#FF8FC1', '#7FD4FF', LEMON];
  let stickers = '';
  for (let x = 10; x < 1270; x += 22 + rnd() * 30) {
    const c = STICK[Math.floor(rnd() * STICK.length)];
    const y = 6 + rnd() * 16;
    const k = rnd();
    const a = (rnd() - 0.5) * 30;
    stickers += k < 0.3 ? P(c, ring(r1(x), r1(y), r1(4 + rnd() * 2)), ' stroke="#FFFFFF" stroke-width="1.4"')
      : k < 0.6 ? P(c, sq(r1(x), r1(y), r1(8 + rnd() * 3), a), ' stroke="#FFFFFF" stroke-width="1.4"')
        : k < 0.8 ? P(c, `M${r1(x)} ${r1(y + 4)} C${r1(x - 6)} ${r1(y)} ${r1(x - 4)} ${r1(y - 5)} ${r1(x)} ${r1(y - 2)} C${r1(x + 4)} ${r1(y - 5)} ${r1(x + 6)} ${r1(y)} ${r1(x)} ${r1(y + 4)} Z`, ' stroke="#FFFFFF" stroke-width="1.2"')
          : P(c, `M${r1(x)} ${r1(y - 5)} l1.6 3.4 3.8 .5 -2.8 2.6 .7 3.8 -3.3 -1.8 -3.3 1.8 .7 -3.8 -2.8 -2.6 3.8 -.5 Z`, ' stroke="#FFFFFF" stroke-width="1"');
  }
  // the worktop and the back bench as perspective trapezoids
  const bench = `M${T(34)} 34 H${1280 - T(34)} L${1280 - T(150)} 150 H${T(150)} Z`;
  const top = `M${T(166)} 166 H${1280 - T(166)} L1280 420 H0 Z`;
  let seams = '';
  let seamsHi = '';
  for (let xf = -520; xf <= 1800; xf += 232) { seams += `M${seamX(xf, 166)} 166 L${xf} 420 `; seamsHi += `M${seamX(xf, 166) + 1.2} 166 L${xf + 1.6} 420 `; }
  let benchSeams = '';
  for (let xf = -400; xf <= 1700; xf += 210) benchSeams += `M${seamX(xf, 34)} 34 L${seamX(xf, 150)} 150 `;
  // the rubber prep mat (layout.DECOR.mat: x 188–718, design y 618–708 → table 334–424), its top edge narrower
  const mat = 'M196 334 H710 Q716 334 717 340 L719 412 Q719 418 713 418 H193 Q187 418 187 412 L189 340 Q190 334 196 334 Z';
  let dots = '';
  let dotsLo = '';
  for (let y = 342; y < 414; y += 9) {
    const k = 0.75 + 0.25 * ((y - 334) / 84);
    for (let x = 200 + ((y / 9) % 2) * 5; x < 708; x += 11 * k) { dots += ell(r1(x), y, r1(2.4 * k), r1(1.6 * k)) + ' '; dotsLo += ell(r1(x + 0.8), r1(y + 1), r1(2.4 * k), r1(1.6 * k)) + ' '; }
  }
  const body = [
    `<defs><linearGradient id="asTbTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6F8FA"/><stop offset=".28" stop-color="#D5DAE2"/><stop offset=".72" stop-color="#A3ABB8"/><stop offset="1" stop-color="#7E8797"/></linearGradient>` +
      `<linearGradient id="asTbBench" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2F4F7"/><stop offset="1" stop-color="#C3C9D3"/></linearGradient>` +
      `<radialGradient id="asTbKey" gradientUnits="userSpaceOnUse" cx="420" cy="90" r="820"><stop offset="0" stop-color="${WARM_RIM}" stop-opacity=".55"/><stop offset=".45" stop-color="${WARM_RIM}" stop-opacity=".14"/><stop offset="1" stop-color="${WARM_RIM}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="asTbFall" gradientUnits="userSpaceOnUse" cx="560" cy="170" r="900"><stop offset=".45" stop-color="#140C1C" stop-opacity="0"/><stop offset="1" stop-color="#140C1C" stop-opacity=".42"/></radialGradient>` +
      `<radialGradient id="asTbTile" gradientUnits="userSpaceOnUse" cx="460" cy="-30" r="760"><stop offset="0" stop-color="#FFF4DE"/><stop offset=".7" stop-color="${TILE}"/><stop offset="1" stop-color="#C9A579"/></radialGradient>` +
      `<linearGradient id="asTbMat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${MAT_HI}"/><stop offset="1" stop-color="${MAT}"/></linearGradient></defs>`,
    // the back wall: tiles + stickers, a shadow under the lip
    `<rect x="0" y="0" width="1280" height="40" fill="url(#asTbTile)"/>`,
    S(TILE_LINE, 1.2, grout),
    stickers,
    `<rect x="0" y="0" width="1280" height="8" fill="#2A1A10" fill-opacity=".4"/>`,
    // the side walls where the table narrows toward the back (warm tiles in shadow)
    P('#5E3E2C', `M0 0 H${T(34) + 2} L0 420 Z`), P('#5E3E2C', `M1280 0 H${1278 - T(34)} L1280 420 Z`),
    S('#7A5440', 1, `M0 60 L${r1(T(34) * 0.9)} 30 M0 120 L${r1(T(34) * 0.8)} 70 M0 180 L${r1(T(34) * 0.65)} 110 M1280 60 L${r1(1280 - T(34) * 0.9)} 30 M1280 120 L${r1(1280 - T(34) * 0.8)} 70 M1280 180 L${r1(1280 - T(34) * 0.65)} 110`),
    // the back bench: lighter, raised; its panel seams; its wood nosing (a real step); the step's shadow on the worktop
    P('url(#asTbBench)', bench),
    S('#8E97A5', 1, benchSeams, ' stroke-opacity=".35"'),
    S('#FFFFFF', 1.2, brush(38, 146, 26, 11), ' stroke-opacity=".3"'),
    P('url(#gkWood)', `M${T(150)} 150 H${1280 - T(150)} L${1280 - T(166)} 166 H${T(166)} Z`),
    S('#FFF2C8', 1.6, `M${T(150)} 150.8 H${1280 - T(150)}`, ' stroke-opacity=".8"'),
    S(WOOD_LO, 1, `M${T(158)} 159 Q320 157 640 160 T${1280 - T(158)} 159`, ' stroke-opacity=".5"'),
    // the main worktop: brushed steel panels receding to the back, lighter at the back, seams toward the vanishing point
    P('url(#asTbTop)', top),
    S('#6E7786', 1.2, seams, ' stroke-opacity=".32"'), S('#FFFFFF', 1, seamsHi, ' stroke-opacity=".35"'),
    `<rect x="0" y="166" width="1280" height="22" fill="url(#gkInner)"/>`,
    S('#FFFFFF', 1.3, brush(170, 416, 46, 21), ' stroke-opacity=".26"'),
    S('#5B6372', 1.1, brush(170, 416, 22, 22), ' stroke-opacity=".12"'),
    // the prep mat with its rubber dots in perspective and a soft contact shadow
    P('#140C1C', 'M190 338 H720 L722 424 H186 Z', ' fill-opacity=".22"'),
    P('url(#asTbMat)', mat, ` stroke="${MAT_LO}" stroke-width="2.4" stroke-linejoin="round"`),
    P(MAT_LO, dotsLo), P(lit(MAT, 0.25), dots),
    S(lit(MAT_HI, 0.3), 1.6, 'M198 336.6 H708', ' stroke-linecap="round"'),
    // the warm key light (upper left) and the falloff to the edges
    `<rect x="0" y="34" width="1280" height="402" fill="url(#asTbKey)"/>`,
    `<rect x="0" y="0" width="1280" height="436" fill="url(#asTbFall)"/>`,
    // front edge: a steel nosing over warm wood
    `<rect x="0" y="420" width="1280" height="16" fill="url(#gkWood)"/>`,
    S(WOOD_LO, 1.1, 'M0 428 Q220 425 460 429 T960 427 T1280 429', ' stroke-opacity=".5"'),
    P(STEEL_HI, 'M0 418 H1280 V421 H0 Z', ` stroke="${STEEL_LINE}" stroke-width="1"`),
  ];
  return `<svg class="as-table" viewBox="0 0 1280 436" preserveAspectRatio="none" aria-hidden="true">${body.join('')}</svg>`;
}

export function counterLipSVG() {
  return `<svg class="as-lip" viewBox="0 0 1280 16" preserveAspectRatio="none" aria-hidden="true">` +
    `<rect x="0" y="0" width="1280" height="7" fill="url(#gkWood)"/>${S('#FFF2C8', 1.6, 'M0 1.2 H1280', ' stroke-opacity=".85"')}` +
    `<rect x="0" y="7" width="1280" height="6" fill="url(#gkChrome)"/>${S(STEEL_LINE, 1, 'M0 7 H1280 M0 13 H1280')}` +
    `<rect x="0" y="13" width="1280" height="3" fill="#140C1C" fill-opacity=".35"/></svg>`;
}

export function shelfSVG(n = 4, { autoSeal = false } = {}) {
  const k = int(n, 1, 6, 4);
  const cols = 3;
  const cw = 240 / cols;
  let rings = '';
  let locks = '';
  for (let i = 0; i < 6; i++) {
    const row = i < cols ? 0 : 1;
    const col = row ? i - cols : i;
    const cx = r1(col * cw + cw / 2);
    const cy = row ? 240 : 114;
    if (i < k) rings += `${ell(cx, cy, r1(cw * 0.32), 5.6)} `;
    else locks += S(INK_BG, 1.4, ell(cx, cy, r1(cw * 0.32), 5.6), ' stroke-opacity=".5" stroke-dasharray="4 3"') + lockBadge(cx, cy - 34, 12);
  }
  const tier = (y) => P('url(#gkSteelTop)', `M4 ${y} H236 L240 ${y + 16} H0 Z`, ` stroke="${STEEL_LINE}" stroke-width="1"`) + P(G.steel, `M0 ${y + 16} H240 V${y + 22} H0 Z`);
  const body = [
    ao(120, 250, 124, 8),
    // warm wood back panel with a soft light pool, steel posts
    P(WOOD_LO, 'M6 0 H234 V244 H6 Z'), P(WOOD, 'M10 4 H230 V104 H10 Z M10 126 H230 V230 H10 Z', ' fill-opacity=".6"'),
    `<path fill="url(#gkGlow)" d="M10 4 H230 V104 H10 Z M10 126 H230 V230 H10 Z" fill-opacity=".6"/>`,
    S(WOOD_HI, 1.2, 'M10 34 H230 M10 68 H230 M10 158 H230 M10 194 H230', ' stroke-opacity=".45"'),
    P(G.steel, 'M0 0 H8 V250 H0 Z M232 0 H240 V250 H232 Z', ` stroke="${STEEL_LINE}" stroke-width="1"`),
    tier(106), tier(232),
    P(dark(STEEL, 0.25), rings), over(rings, G.inner, 0.6),
    locks,
    autoSeal ? `<g class="as-gantry">${P(GUN, 'M-4 -18 H244 V-4 H-4 Z', ` stroke="${GUN_DEEP}" stroke-width="1.2" stroke-linejoin="round"`)}${over('M-4 -18 H244 V-4 H-4 Z', G.front)}` +
      `${P(LEMON, 'M8 -14 H232 V-9 H8 Z')}<g class="as-gantry-head">${P(G.steel, 'M100 -4 H140 V8 H100 Z', ` stroke="${STEEL_LINE}" stroke-width="1"`)}${P(PAPER, 'M108 8 H132 V12 H108 Z')}</g></g>` : '',
  ];
  return svg('as-shelf', '0 0 240 250', body.join(''), ` data-n="${k}" data-auto="${autoSeal ? 1 : 0}"`);
}

// covered spots (not bought / not on the menu yet): a dust cover in muted steel and a padlock badge, in the station's box
const COVER = '#8C95A5';
const COVER_LO = '#6E7686';
export const LOCK_VB = {
  tea: [100, 155], top: [100, 95], ice: [100, 95], lemon: [100, 95], sugar: [70, 108], sealer: [110, 150], slot: [100, 50], helper: [142, 166],
  milk: [100, 160], foam: [100, 135], shaker: [100, 120], board: [100, 80], waffle: [100, 90], snack: [64, 70], bag: [100, 105],
};
export function lockedSVG(kind = 'tea') {
  const [w, h] = LOCK_VB[kind] || [100, 140];
  const dash = ` stroke="${INK_BG}" stroke-opacity=".4" stroke-width="1.6" stroke-dasharray="5 4"`;
  let body = '';
  if (kind === 'slot') {
    body = ao(50, 32, 48, 13) + P(COVER, ell(50, 27, 42, 14.5), ` stroke="${COVER_LO}" stroke-width="1.4"`) + over(ell(50, 27, 42, 14.5), G.top) +
      P(lit(COVER, 0.2), ell(50, 25, 30, 9)) + lockBadge(50, 25, 12);
  } else if (kind === 'helper') {
    body = `<path fill="none"${dash} d="M71 20 a26 26 0 1 1 -0.1 0 Z M22 166 Q24 104 71 98 Q118 104 120 166"/>` + lockBadge(71, 122, 18);
  } else if (kind === 'top' || kind === 'ice' || kind === 'lemon') {
    body = ao(50, 76, 52, 10) + `<path fill="none"${dash} d="${PAN_RIM}"/>` +
      P(COVER, 'M8 32 H92 L96 60 H4 Z', ` stroke="${COVER_LO}" stroke-width="1.2" stroke-linejoin="round"`) + over('M8 32 H92 L96 60 H4 Z', G.top) +
      P(G.steel, 'M4 60 H96 L94 74 H6 Z') + P(COVER_LO, 'M40 24 H60 V32 H40 Z') + lockBadge(50, 50, 13);
  } else {
    // a draped cover over the station's silhouette: rounded top, folds, a soft shadow
    const x0 = w * 0.12;
    const x1 = w * 0.88;
    const top = h * 0.14;
    const bot = h * 0.9;
    const d = `M${r1(x0 + 4)} ${r1(top + h * 0.12)} Q${r1(x0 + 4)} ${r1(top)} ${r1(w / 2)} ${r1(top)} Q${r1(x1 - 4)} ${r1(top)} ${r1(x1 - 4)} ${r1(top + h * 0.12)} L${r1(x1 + w * 0.06)} ${r1(bot)} Q${r1(w * 0.7)} ${r1(bot + h * 0.04)} ${r1(w / 2)} ${r1(bot - h * 0.01)} Q${r1(w * 0.3)} ${r1(bot + h * 0.04)} ${r1(x0 - w * 0.06)} ${r1(bot)} Z`;
    const folds = `M${r1(w * 0.34)} ${r1(top + h * 0.12)} L${r1(w * 0.28)} ${r1(bot - 2)} M${r1(w / 2)} ${r1(top + h * 0.06)} V${r1(bot - 3)} M${r1(w * 0.66)} ${r1(top + h * 0.12)} L${r1(w * 0.72)} ${r1(bot - 2)}`;
    body = ao(w / 2, bot + 2, w * 0.46, h * 0.05) + P(COVER, d, ` stroke="${COVER_LO}" stroke-width="1.4" stroke-linejoin="round"`) + over(d, G.cyl, 0.8) +
      S(COVER_LO, 1.6, folds, ' stroke-linecap="round" stroke-opacity=".8"') + lockBadge(w / 2, h * 0.52, Math.min(17, w * 0.2));
  }
  return svg('as-locked', `0 0 ${w} ${h}`, body, ` data-kind="${kind}"`);
}

export function teaManifoldSVG(n = 3) {
  const k = int(n, 1, 3, 3);
  const w = 264 / k;
  let drops = '';
  for (let i = 0; i < k; i++) drops += `M${r1(w * (i + 0.5) - 5)} 24 h10 v14 h-10 Z `;
  return svg('as-manifold', '0 0 264 40', P(G.chrome, `M4 14 H260 V26 H4 Z ${drops}`, ` stroke="${STEEL_LINE}" stroke-width="1.2"`) +
    S('#FFFFFF', 1.6, 'M6 16.5 H258', ' stroke-opacity=".9"') + P(GUN, ring(18, 8, 7), ` stroke="${GUN_DEEP}" stroke-width="1.2"`) + over(ring(18, 8, 7), G.sph) +
    S(STEEL_LINE, 2, 'M18 15 V20'));
}

export function goldenCardSVG() {
  return svg('as-golden-card', '0 0 70 60', ao(35, 58, 30, 4) + P(WOOD_LO, 'M8 58 L14 6 H56 L62 58 Z') + P(PAPER, 'M12 54 L17 8 H53 L58 54 Z', ` stroke="${WOOD_LO}" stroke-width="1.4"`) +
    over('M12 54 L17 8 H53 L58 54 Z', G.box) +
    P(TAKE, 'M26 18 H44 L42 46 H28 Z', ` stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"`) + over('M26 18 H44 L42 46 H28 Z', G.cyl) +
    S(INK, 1.8, 'M24 18 H46 M38 18 L42 10') +
    P(GOLD_HI, 'M50 22 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z M18 34 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 Z', ` stroke="${TAKE_DEEP}" stroke-width="1"`));
}

void NIGHT_900; void COUNTER; void celShade; void WOOD; void WOOD_HI;
