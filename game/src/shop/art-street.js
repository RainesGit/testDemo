// art-street.js — gameplay v3 landscape art outside the work table (docs/gameplay-v3-shop.md 10.1–10.3, 10.7):
// the night street in perspective, the corner building people walk out from behind, full-body walkers (heads from
// art.js customerSVG + simple bodies), the part-timer, and the shop-front upgrade props. Pure SVG strings, seeded
// (same input → same output), no DOM, no filters / blur / images. Palette tokens from art.js (docs/art-direction-v2.md
// 2.1): the street is cool and backlit, warm light only spills from the shop.
//
//   streetSVG({ neon, rail })   <svg class="street-svg">, viewBox 0 0 1280 284 (stage design px down to layout.TABLE_Y):
//                               sky, far buildings (rooftops, balconies, picture signs) fading into a cool haze with
//                               distance (atmospheric perspective), a wet road with a sheen and light reflections, our
//                               sidewalk under the shop's soft warm light (pools + window shafts) and the corner lamp;
//                               neon = the neon-sign upgrade, rail = queue stanchions along the line (layout.streetPoint).
//                               The scenery is drawn in the 342-tall frame of the first version and mapped into the
//                               shorter street band by SQUASH (the horizon stays at layout's vanishing point)
//   cornerSVG()                 <svg class="corner-svg">, same viewBox: the lit corner shop (drawn over walkers)
//   awningSVG()                 <svg class="awning-svg">, viewBox 0 0 1280 40: the shop's striped valance from inside
//   roadLane(x, far), farWalk(x)   traffic / passer-by geometry for ui.js (y and scale at screen x)
//   vehicleSVG(kind, seed)      <svg class="vehicle-svg" data-kind="car|scooter">, viewBox 0 0 200 90, facing left
//                               (cars and plain scooters only: no delivery riders)
//   pedSVG(seed)                <svg class="ped-svg">, viewBox 0 0 24 60: a passer-by silhouette for the far sidewalk
//   walkerSVG({ cid, visit, fixed, oke, uid })   <svg class="walker-svg" data-style>, viewBox 0 0 200 480 (feet at 100, 476):
//                               legs g.wk-leg-l/r, arms g.wk-arm-l/r (swing in CSS), g.wk-phone (a fan filming), g.wk-sign
//                               (the picture-only fan sign), g.wk-ticket (walking off with the 250 ticket), g.wk-back (the
//                               back of the head, shown while walking away), g.wk-sil (the far, outline-free silhouette;
//                               CSS fades it by distance), the head svg.cust; uid picks a clothing colour + cut so
//                               neighbours never match (walkerLook)
//   helperSVG(level)            <svg class="helper-svg">, viewBox 0 0 142 166: the part-timer's bust behind the worktop
//   acSVG(), speakerSVG(), ticketMachineSVG(), rotateIconSVG()   shop props and the rotate-your-phone icon
import { PALETTE, mixColor, celShade, ringPath, mulberry32, fnv1a, customerSVG, customerLook } from '../art.js';
import { streetPoint, TABLE_Y } from './layout.js';
import { G, ell as kEll, softLine, warmShade } from './art-kit.js';
import { hasPic, picIds, picSet, picSrc } from './pics.js';

const { INK, INK_BG, PAPER, PAPER_SH, GUN, GUN_DEEP, SHUT, TAKE, LEMON, GOLD_HI, RIM, NIGHT_900, NIGHT_700, NIGHT_500,
  STEEL_HI, STEEL, STEEL_LO, COUNTER_HI, COUNTER, COUNTER_LO, WARM_RIM, WOOD_DK_HI } = PALETTE;
const PINK = '#FF8FC1';
const WINDOW = '#FFD98A';
const r1 = (n) => Math.round(n * 10) / 10;
const svg = (cls, vb, body, attrs = '') => `<svg class="${cls}" viewBox="${vb}" overflow="visible" aria-hidden="true"${attrs}>${body}</svg>`;
const ell = (cx, cy, rx, ry) => `M${r1(cx - rx)} ${r1(cy)} a${rx} ${ry} 0 1 0 ${r1(2 * rx)} 0 a${rx} ${ry} 0 1 0 ${r1(-2 * rx)} 0`;
const V = { x: -300, y: 150 };
// a line through the vanishing point: y at x for a line that is at y0 at x = 1280
const persp = (y0, x) => V.y + ((y0 - V.y) * (x - V.x)) / (1280 - V.x);
// the scenery frame (342 tall, horizon at 150) → the street band (TABLE_Y tall, horizon at layout's 122)
const H0 = 342;
const HORIZON = 122;
const KY = (TABLE_Y + 2 - HORIZON) / (H0 - V.y);
const mapY = (y) => HORIZON + (y - V.y) * KY;
const SQUASH = `translate(0 ${HORIZON}) scale(1 ${KY.toFixed(4)}) translate(0 ${-V.y})`;
const HAZE = '#C27A8E'; // a rose dusk haze (art direction 14: warm evening, was a blue night haze)

// ─── The street ────────────────────────────────────────────────────────────────────────────────
const SIGN_ICONS = [
  // picture-only shop signs on the far buildings: a cup, a bowl with steam, a star, a heart, a fish
  (x, y, k) => `M${r1(x - 5 * k)} ${r1(y - 6 * k)} h${r1(10 * k)} l${r1(-1.6 * k)} ${r1(12 * k)} h${r1(-6.8 * k)} Z`,
  (x, y, k) => `M${r1(x - 7 * k)} ${r1(y - 2 * k)} h${r1(14 * k)} a${r1(7 * k)} ${r1(6 * k)} 0 0 1 ${r1(-14 * k)} 0 Z`,
  (x, y, k) => `M${r1(x)} ${r1(y - 7 * k)} l${r1(2.2 * k)} ${r1(5 * k)} ${r1(5 * k)} ${r1(0.6 * k)} ${r1(-4 * k)} ${r1(3.4 * k)} ${r1(1.4 * k)} ${r1(5 * k)} ${r1(-4.6 * k)} ${r1(-2.6 * k)} ${r1(-4.6 * k)} ${r1(2.6 * k)} ${r1(1.4 * k)} ${r1(-5 * k)} ${r1(-4 * k)} ${r1(-3.4 * k)} ${r1(5 * k)} ${r1(-0.6 * k)} Z`,
  (x, y, k) => `M${r1(x)} ${r1(y + 6 * k)} C${r1(x - 9 * k)} ${r1(y)} ${r1(x - 6 * k)} ${r1(y - 8 * k)} ${r1(x)} ${r1(y - 3 * k)} C${r1(x + 6 * k)} ${r1(y - 8 * k)} ${r1(x + 9 * k)} ${r1(y)} ${r1(x)} ${r1(y + 6 * k)} Z`,
  (x, y, k) => `M${r1(x - 8 * k)} ${r1(y)} Q${r1(x - 2 * k)} ${r1(y - 6 * k)} ${r1(x + 5 * k)} ${r1(y)} L${r1(x + 9 * k)} ${r1(y - 4 * k)} V${r1(y + 4 * k)} L${r1(x + 5 * k)} ${r1(y)} Q${r1(x - 2 * k)} ${r1(y + 6 * k)} ${r1(x - 8 * k)} ${r1(y)} Z`,
];
function farBuildings() {
  const rnd = mulberry32(fnv1a('street'));
  const fills = ['#5A3A6A', '#6A3E5E', '#4E3A6E', '#734463', '#5C4270', '#66405E'];
  const signs = [GUN, SHUT, LEMON, RIM, PINK, TAKE];
  let out = '';
  let lit = '';
  let tv = '';
  let dark = '';
  let glow = '';
  let roof = '';
  let rail = '';
  let icons = '';
  let x = 1300;
  let i = 0;
  while (x > 40) {
    const k = (x - V.x) / (1280 - V.x);
    const w = (120 + rnd() * 90) * k;
    const h = (95 + rnd() * 80) * k;
    const base = persp(166, x);
    const x0 = x - w;
    const top = base - h;
    // atmospheric perspective: the further (smaller, toward the vanishing point), the hazier and bluer
    const fill = mixColor(fills[i % fills.length], HAZE, 0.25 + 0.75 * Math.min(1, k * 1.1));
    out += `<path fill="${fill}" d="M${r1(x0)} ${r1(base)} V${r1(top)} H${r1(x)} V${r1(base)} Z"/>`;
    out += `<path fill="url(#gkCylSoft)" fill-opacity=".5" d="M${r1(x0)} ${r1(base)} V${r1(top)} H${r1(x)} V${r1(base)} Z"/>`;
    // a lighter cornice and a cool rim on the left edge (backlit by the sky glow)
    out += `<path fill="${mixColor(fill, '#8C88C8', 0.7)}" d="M${r1(x0 - 2 * k)} ${r1(top)} H${r1(x + 2 * k)} V${r1(top + 5 * k)} H${r1(x0 - 2 * k)} Z"/>`;
    out += `<path fill="none" stroke="${RIM}" stroke-opacity=".3" stroke-width="${r1(2 * k)}" d="M${r1(x0)} ${r1(base)} V${r1(top)}"/>`;
    // rooftop: a water tank on legs, AC boxes or an antenna
    const r = rnd();
    if (r < 0.35) roof += `M${r1(x0 + w * 0.3)} ${r1(top)} v${r1(-6 * k)} h${r1(2 * k)} v${r1(-12 * k)} h${r1(14 * k)} v${r1(12 * k)} h${r1(2 * k)} v${r1(6 * k)} Z `;
    else if (r < 0.7) roof += `M${r1(x0 + w * 0.2)} ${r1(top)} v${r1(-8 * k)} h${r1(12 * k)} v${r1(8 * k)} Z M${r1(x0 + w * 0.55)} ${r1(top)} v${r1(-6 * k)} h${r1(10 * k)} v${r1(6 * k)} Z `;
    else roof += `M${r1(x0 + w * 0.7)} ${r1(top)} v${r1(-22 * k)} h${r1(1.6 * k)} v${r1(22 * k)} Z M${r1(x0 + w * 0.7 - 6 * k)} ${r1(top - 16 * k)} h${r1(13 * k)} v${r1(1.4 * k)} h${r1(-13 * k)} Z `;
    // windows (warm, a few blue TV glows) and balcony rails every other floor
    const ww = 9 * k;
    const wh = 11 * k;
    let floor = 0;
    for (let wy = top + 12 * k; wy < base - 34 * k; wy += 20 * k) {
      for (let wx = x0 + 10 * k; wx < x - 14 * k; wx += 18 * k) {
        const d = `M${r1(wx)} ${r1(wy)} h${r1(ww)} v${r1(wh)} h${r1(-ww)} Z `;
        const q = rnd();
        if (q < 0.36) lit += d; else if (q < 0.44) tv += d; else dark += d;
      }
      if (floor % 2 === 1 && w > 60) rail += `M${r1(x0 + 6 * k)} ${r1(wy + wh + 3 * k)} H${r1(x - 6 * k)} `;
      floor++;
    }
    // the ground floor shop: a glowing front + a sign panel in a shop colour with a picture
    const sc = signs[Math.floor(rnd() * signs.length)];
    glow += `<path fill="${WINDOW}" fill-opacity=".55" d="M${r1(x0 + 6 * k)} ${r1(base - 22 * k)} H${r1(x - 6 * k)} V${r1(base)} H${r1(x0 + 6 * k)} Z"/>`;
    glow += `<path fill="${sc}" fill-opacity=".9" d="M${r1(x0 + 8 * k)} ${r1(base - 32 * k)} H${r1(x - 8 * k)} V${r1(base - 23 * k)} H${r1(x0 + 8 * k)} Z"/>`;
    if (k > 0.45) icons += SIGN_ICONS[i % SIGN_ICONS.length](x0 + w / 2, base - 27.5 * k, k * 0.42) + ' ';
    x = x0 - 4 * k;
    i++;
  }
  return out + `<path fill="${mixColor(NIGHT_900, NIGHT_500, 0.5)}" d="${roof}"/>` +
    `<path fill="${WINDOW}" fill-opacity=".8" d="${lit}"/><path fill="#9EE3FF" fill-opacity=".55" d="${tv}"/><path fill="${NIGHT_900}" fill-opacity=".55" d="${dark}"/>` +
    `<path fill="none" stroke="#8C88C8" stroke-opacity=".45" stroke-width="1.4" d="${rail}"/>` + glow +
    `<path fill="${PAPER}" fill-opacity=".9" d="${icons}"/>`;
}

function sidewalkLines() {
  let d = '';
  for (let xb = -500; xb <= 2000; xb += 110) d += `M${V.x} ${V.y} L${xb} 342 `;
  let cross = '';
  for (let k = 1; k < 9; k++) {
    const y0 = 222 + (k * k) * 14; // spacing widens toward the camera
    if (y0 > 345) break;
    cross += `M-10 ${r1(persp(y0, -10))} L1290 ${r1(persp(y0, 1290))} `;
  }
  return `<path fill="none" stroke="#2C2A44" stroke-width="1.6" stroke-opacity=".55" d="${d} ${cross}"/>`;
}

function stanchions() {
  let posts = '';
  let rope = '';
  const pts = [];
  for (let u = 0.08; u <= 0.75; u += 0.13) pts.push(streetPoint(u, -0.55));
  pts.forEach((p, i) => {
    const h = 150 * p.s;
    const w = 7 * p.s;
    posts += `<path fill="${STEEL}" stroke="${INK_BG}" stroke-width="${r1(2 * p.s)}" d="M${r1(p.x - w / 2)} ${r1(p.y)} V${r1(p.y - h)} H${r1(p.x + w / 2)} V${r1(p.y)} Z"/>`;
    posts += `<path fill="${STEEL_LO}" d="${ell(p.x, p.y, 16 * p.s, 4 * p.s)}"/><path fill="${STEEL_HI}" d="${ell(p.x, p.y - h, 6 * p.s, 5 * p.s)}"/>`;
    if (i) {
      const q = pts[i - 1];
      const mx = (p.x + q.x) / 2;
      const my = (p.y - 140 * p.s + q.y - 140 * q.s) / 2 + 22 * p.s;
      rope += `M${r1(q.x)} ${r1(q.y - 140 * q.s)} Q${r1(mx)} ${r1(my)} ${r1(p.x)} ${r1(p.y - 140 * p.s)} `;
    }
  });
  return `<g class="st-rail"><path fill="none" stroke="${GUN_DEEP}" stroke-width="5" stroke-linecap="round" d="${rope}"/>` +
    `<path fill="none" stroke="${GUN}" stroke-width="2.4" stroke-linecap="round" d="${rope}"/>${posts}</g>`;
}

function neonSign() {
  // the neon-sign upgrade: a pink cup and a cyan heart on the far building, glowing (stacked strokes, no blur)
  const cup = 'M920 58 H972 L964 122 H928 Z M916 58 H976 M950 58 L960 38';
  const heart = 'M1010 84 C1010 70 1030 68 1032 82 C1034 68 1054 70 1054 84 C1054 100 1032 112 1032 116 C1032 112 1010 100 1010 84 Z';
  const glow = (d, c) => `<path fill="none" stroke="${c}" stroke-opacity=".18" stroke-width="16" stroke-linejoin="round" stroke-linecap="round" d="${d}"/>` +
    `<path fill="none" stroke="${c}" stroke-opacity=".35" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" d="${d}"/>` +
    `<path fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" d="${d}"/>`;
  return `<g class="st-neon"><path fill="${NIGHT_900}" fill-opacity=".7" d="M900 28 H1072 V134 H900 Z"/>${glow(cup, PINK)}${glow(heart, RIM)}` +
    `<path fill="none" stroke="${PINK}" stroke-width="2" d="M934 96 h24 M938 108 h16"/></g>`;
}

/** Road geometry for the traffic layer (ui.js): the centre of the near / far lane at screen x, and the size there. */
export function roadLane(x, far = false) {
  const y0 = far ? 184 : 210;
  return { y: r1(mapY(persp(y0, x))), s: ((x - V.x) / (1280 - V.x)) * KY };
}
/** The far sidewalk (across the road) for passers-by: feet y and a person's scale at screen x. */
export function farWalk(x) {
  return { y: r1(mapY(persp(168, x))), s: ((x - V.x) / (1280 - V.x)) * 0.2 * KY };
}

export function streetSVG({ neon = false, rail = false } = {}) {
  const roadFar = (x) => persp(170, x);
  const roadNear = (x) => persp(226, x);
  // window-mullion light shafts from the shop across our sidewalk
  let shafts = '';
  for (let k = 0; k < 6; k++) {
    const xa = 520 + k * 124;
    shafts += `M${xa} 342 L${xa + 54} 342 L${xa + 30} ${r1(roadNear(xa) + 6)} L${xa - 6} ${r1(roadNear(xa) + 6)} Z `;
  }
  const body = [
    `<defs><linearGradient id="stSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A3478"/><stop offset=".55" stop-color="#C2577E"/><stop offset="1" stop-color="#FFB36B"/></linearGradient>`,
    `<radialGradient id="stPool" cx="820" cy="390" r="660" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${WARM_RIM}" stop-opacity=".6"/><stop offset=".3" stop-color="#FFD07E" stop-opacity=".32"/><stop offset=".6" stop-color="#FFC66E" stop-opacity=".12"/><stop offset="1" stop-color="${WARM_RIM}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="stLamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${GOLD_HI}" stop-opacity=".42"/><stop offset=".5" stop-color="${GOLD_HI}" stop-opacity=".16"/><stop offset="1" stop-color="${GOLD_HI}" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="stShaft" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFD98A" stop-opacity=".3"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></linearGradient>`,
    `<linearGradient id="stHaze" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${HAZE}" stop-opacity=".62"/><stop offset=".45" stop-color="${HAZE}" stop-opacity=".22"/><stop offset="1" stop-color="${HAZE}" stop-opacity="0"/></linearGradient>`,
    `<linearGradient id="stHorizon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC27A" stop-opacity="0"/><stop offset=".7" stop-color="#FFC27A" stop-opacity=".28"/><stop offset="1" stop-color="#FFC27A" stop-opacity="0"/></linearGradient>`,
    `<linearGradient id="stSheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset=".55" stop-color="#FFD2B0" stop-opacity=".16"/><stop offset="1" stop-color="#FFE2A8" stop-opacity=".22"/></linearGradient>`,
    `<linearGradient id="stStreak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD98A" stop-opacity=".5"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></linearGradient></defs>`,
    `<g transform="${SQUASH}">`,
    `<rect x="0" y="0" width="1280" height="190" fill="url(#stSky)"/>`,
    // dusk: the low sun glowing behind the buildings, a few first stars high up
    `<radialGradient id="stSun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF0B8"/><stop offset=".35" stop-color="#FFD27A" stop-opacity=".9"/><stop offset="1" stop-color="#FF9E6A" stop-opacity="0"/></radialGradient>`,
    `<ellipse cx="930" cy="150" rx="190" ry="120" fill="url(#stSun)"/>`,
    `<path fill="#FFF3D0" d="${ell(930, 150, 40, 40)}"/>`,
    `<path fill="${PAPER}" fill-opacity=".55" d="${[[180, 22], [330, 12], [520, 30], [1180, 18], [1050, 10]].map(([x, y]) => ell(x, y, 1.5, 1.5)).join(' ')}"/>`,
    farBuildings(),
    // the haze: thick toward the vanishing point (left), a glow band along the horizon
    `<rect x="0" y="20" width="1280" height="150" fill="url(#stHaze)"/>`,
    `<rect x="0" y="110" width="1280" height="64" fill="url(#stHorizon)"/>`,
    neon ? neonSign() : '',
    // far sidewalk, road with a dashed centre line, a zebra crossing near the corner
    `<path fill="#7A5A6E" d="M0 ${r1(persp(166, 0))} L1280 166 L1280 ${r1(roadFar(1280))} L0 ${r1(roadFar(0))} Z"/>`,
    `<path fill="#3E3350" d="M0 ${r1(roadFar(0))} L1280 ${r1(roadFar(1280))} L1280 ${r1(roadNear(1280))} L0 ${r1(roadNear(0))} Z"/>`,
    // the wet road: a sheen toward us, the far shops' light reflected in long streaks
    `<path fill="url(#stSheen)" d="M0 ${r1(roadFar(0))} L1280 ${r1(roadFar(1280))} L1280 ${r1(roadNear(1280))} L0 ${r1(roadNear(0))} Z"/>`,
    `<path fill="${WINDOW}" fill-opacity=".1" d="M0 ${r1(roadFar(0))} L1280 ${r1(roadFar(1280))} L1280 ${r1(roadFar(1280) + 14)} L0 ${r1(roadFar(0) + 5)} Z"/>`,
    (() => {
      let d = '';
      for (const x of [300, 470, 640, 790, 960, 1130]) { const y = roadFar(x); const w = 6 * ((x - V.x) / 1580); d += `M${r1(x - w)} ${r1(y + 1)} h${r1(2 * w)} l${r1(w * 0.6)} ${r1(roadNear(x) - y - 4)} h${r1(-3.2 * w)} Z `; }
      return `<path fill="url(#stStreak)" d="${d}"/>`;
    })(),
    (() => {
      let d = '';
      for (let x = 1280; x > 0; x -= 64 * ((x - V.x) / 1580) + 6) {
        const k = (x - V.x) / 1580;
        const len = 30 * k;
        const y = (roadFar(x) + roadNear(x)) / 2;
        d += `M${r1(x)} ${r1(y)} L${r1(x - len)} ${r1((roadFar(x - len) + roadNear(x - len)) / 2)} `;
      }
      return `<path fill="none" stroke="${LEMON}" stroke-opacity=".55" stroke-width="2.4" d="${d}"/>`;
    })(),
    (() => {
      let d = '';
      for (let k = 0; k < 6; k++) {
        const xa = 96 + k * 13;
        d += `M${xa} ${r1(roadFar(xa))} L${xa + 7} ${r1(roadFar(xa + 7))} L${xa + 16} ${r1(roadNear(xa + 16))} L${xa + 7} ${r1(roadNear(xa + 7))} Z `;
      }
      return `<path fill="${PAPER}" fill-opacity=".35" d="${d}"/>`;
    })(),
    // our sidewalk: tiles in perspective, a curb, the warm spill from the shop (pool + window shafts), the corner lamp
    `<path fill="#8E6E78" d="M0 ${r1(roadNear(0))} L1280 ${r1(roadNear(1280))} L1280 342 L0 342 Z"/>`,
    sidewalkLines(),
    `<path fill="none" stroke="#D6B3A6" stroke-width="3" d="M0 ${r1(roadNear(0))} L1280 ${r1(roadNear(1280))}"/>`,
    `<path fill="none" stroke="#4A3242" stroke-width="2" d="M0 ${r1(roadNear(0) + 3)} L1280 ${r1(roadNear(1280) + 3)}"/>`,
    `<rect x="0" y="150" width="1280" height="192" fill="url(#stPool)"/>`,
    `<path fill="url(#stShaft)" d="${shafts}"/>`,
    `<ellipse cx="160" cy="276" rx="150" ry="62" fill="url(#stLamp)"/>`,
    // street lamps: one on the far curb, one on our side near the corner (people walk out under it)
    `<path fill="none" stroke="${NIGHT_500}" stroke-width="4" d="M760 ${r1(roadFar(760))} V92 Q760 82 772 82 H790"/><path fill="${GOLD_HI}" d="M784 80 h16 l-3 7 h-10 Z"/>` +
      `<path fill="${GOLD_HI}" fill-opacity=".12" d="M792 88 L760 ${r1(roadNear(760))} L840 ${r1(roadNear(840))} Z"/>`,
    `<path fill="none" stroke="${NIGHT_500}" stroke-width="5" d="M196 270 V128 Q196 116 182 116 H164"/><path fill="${GOLD_HI}" d="M154 113 h18 l-3 8 h-12 Z"/>` +
      `<path fill="${NIGHT_700}" d="${ell(196, 271, 7, 2.4)}"/>`,
    '</g>',
    rail ? stanchions() : '',
  ];
  return svg('street-svg', `0 0 1280 ${TABLE_Y}`, body.join(''), ` preserveAspectRatio="none" data-neon="${neon ? 1 : 0}" data-rail="${rail ? 1 : 0}"`);
}

export function cornerSVG() {
  // the near corner building at the far end of the line: a little lit corner shop; people walk out from behind its
  // edge (x ≈ 74) into the light of its window and the lamp
  const base = 252;
  const body = [
    `<defs><linearGradient id="cnWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7B0"/><stop offset="1" stop-color="#F2B866"/></linearGradient></defs>`,
    `<g transform="${SQUASH}">`,
    `<path fill="${COUNTER_HI}" d="M-20 20 H70 L74 ${base} H-20 Z"/>`,
    // brick courses
    `<path fill="none" stroke="${COUNTER}" stroke-width="1.6" d="${Array.from({ length: 7 }, (_, k) => `M-20 ${36 + k * 16} H${r1(70 + (k * 16 + 16) / 58)}`).join(' ')}"/>`,
    `<path fill="${celShade(COUNTER_HI)}" d="M48 20 H70 L74 ${base} H50 Z"/>`,
    `<path fill="none" stroke="${RIM}" stroke-opacity=".7" stroke-width="3" d="M70 20 L74 ${base}"/>`,
    // upper window with a warm curtain
    `<path fill="url(#cnWin)" stroke="${INK_BG}" stroke-width="2" d="M-6 44 H34 V92 H-6 Z"/><path fill="${GUN_DEEP}" fill-opacity=".7" d="M-6 44 H8 Q12 70 4 92 H-6 Z"/><path fill="none" stroke="${INK_BG}" stroke-width="2" d="M14 44 V92 M-6 68 H34"/>`,
    // striped awning over the shop window
    `<path fill="${GUN}" stroke="${INK_BG}" stroke-width="2" d="M-20 150 H62 L70 168 H-20 Z"/>` +
      `<path fill="${PAPER}" d="M-8 150 H4 L8 168 H-4 Z M16 150 H28 L33 168 H21 Z M40 150 H52 L58 168 H46 Z"/>` +
      `<path fill="none" stroke="${INK_BG}" stroke-width="2" d="M-20 168 Q-12 176 -4 168 Q4 176 12 168 Q20 176 28 168 Q36 176 44 168 Q52 176 60 168 Q66 174 70 168"/>`,
    // the lit window with shelves of snacks, a blade sign with a cup + heart
    `<path fill="url(#cnWin)" stroke="${INK_BG}" stroke-width="2" d="M-20 176 H46 V${base - 4} H-20 Z"/>`,
    `<path fill="${WOOD_DK_HI}" d="M-20 200 H46 V203 H-20 Z M-20 224 H46 V227 H-20 Z"/>`,
    `<path fill="${GUN}" d="M-12 190 h8 v10 h-8 Z M20 214 h8 v10 h-8 Z"/><path fill="${SHUT}" d="M2 192 h8 v8 h-8 Z M30 238 h8 v9 h-8 Z"/><path fill="${TAKE}" d="M-6 214 h10 v10 h-10 Z M8 238 h9 v9 h-9 Z M32 190 h8 v10 h-8 Z"/>`,
    `<path fill="${GUN}" stroke="${INK_BG}" stroke-width="2" d="M44 54 H68 V132 H44 Z"/>`,
    `<path fill="${PAPER}" fill-opacity=".95" d="M49 66 H63 L61 90 H51 Z M47 64 H65 V67 H47 Z M56 64 L60 56 L62 57 L58 64 Z"/>`,
    `<path fill="${LEMON}" d="M48 106 C48 100 56 99 56 105 C56 99 64 100 64 106 C64 113 56 118 56 120 C56 118 48 113 48 106 Z"/>`,
    `<path fill="${WINDOW}" fill-opacity=".22" d="M46 ${base} L74 ${base} L120 ${base + 30} L40 ${base + 30} Z"/>`,
    `<path fill="#1B1311" fill-opacity=".35" d="M-20 ${base} H80 L74 ${base + 8} H-20 Z"/>`,
    `<path fill="url(#gkCylSoft)" d="M-20 20 H70 L74 ${base} H-20 Z" fill-opacity=".6"/>`,
    '</g>',
  ];
  return svg('corner-svg', `0 0 1280 ${TABLE_Y}`, body.join(''), ' preserveAspectRatio="none"');
}

export function awningSVG() {
  let stripes = '';
  for (let x = 0; x < 1280; x += 64) stripes += `M${x} 0 H${x + 32} V22 Q${x + 16} 34 ${x} 22 Z `;
  let cream = '';
  for (let x = 32; x < 1280; x += 64) cream += `M${x} 0 H${x + 32} V22 Q${x + 16} 34 ${x} 22 Z `;
  let bulbs = '';
  for (let x = 20; x < 1280; x += 52) bulbs += ell(x, 36 + Math.sin(x / 40) * 2, 3.6, 3.6) + ' ';
  return svg('awning-svg', '0 0 1280 44', `<path fill="#9A3326" d="${stripes}"/><path fill="#E8D9BC" d="${cream}"/>` +
    `<path fill="none" stroke="${INK_BG}" stroke-width="2" d="M0 1 H1280"/>` +
    `<path fill="none" stroke="${INK_BG}" stroke-width="1.4" d="M0 34 Q320 42 640 34 T1280 34"/><path fill="${GOLD_HI}" d="${bulbs}"/>` +
    `<path fill="${GOLD_HI}" fill-opacity=".18" d="${bulbs.replace(/a3\.6 3\.6/g, 'a7 7').replace(/M(\d+(?:\.\d+)?) /g, (m, x) => `M${Number(x) - 3.4} `)}"/>`, ' preserveAspectRatio="none"');
}

// ─── Traffic and passers-by (never customers, never delivery riders) ───────────────────────────
const CAR_COLORS = ['#E2453C', '#3D8BD9', '#F2EEE6', '#F2C230', '#3A3F4A', '#D45FA0', '#2FA39A'];
/** A car or a scooter in side view, facing left (CSS mirrors it), viewBox 0 0 200 90 (wheels on y 84). */
export function vehicleSVG(kind = 'car', seed = 1) {
  const rnd = mulberry32(fnv1a(`car:${seed}`));
  const c = CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)];
  const body = mixColor(c, NIGHT_500, 0.78);
  const wheel = (x) => `<path fill="${NIGHT_900}" stroke="${INK}" stroke-width="3" d="${ell(x, 72, 14, 14)}"/><path fill="${STEEL_LO}" d="${ell(x, 72, 6, 6)}"/>`;
  if (kind === 'scooter') {
    const shirt = mixColor(CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)], NIGHT_500, 0.7);
    return svg('vehicle-svg', '0 0 200 90', `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">` +
      `<path fill="${body}" d="M50 58 Q52 40 74 40 H96 L104 58 H134 Q140 42 150 40 L150 34 H160 L158 44 Q166 52 166 62 H48 Z"/>` +
      `<path fill="${shirt}" d="M108 40 Q100 16 112 8 H128 Q136 18 132 40 Z"/>` +
      `<path fill="${mixColor('#2D3466', NIGHT_500, 0.8)}" d="M110 40 L126 42 L140 62 L132 64 L118 50 Z"/>` +
      `<path fill="${mixColor(PAPER, NIGHT_500, 0.75)}" d="M106 6 Q106 -10 122 -10 Q138 -10 138 6 Z"/><path fill="${NIGHT_700}" d="M126 -4 H138 V4 H126 Z"/>` +
      `<path fill="none" d="M130 22 L150 30"/></g>${wheel(66)}${wheel(152)}` +
      `<path fill="${GOLD_HI}" d="M160 44 h8 v6 h-8 Z"/><path fill="${GOLD_HI}" fill-opacity=".18" d="M168 42 L200 34 V62 L168 52 Z"/>`, ` data-kind="scooter"`);
  }
  return svg('vehicle-svg', '0 0 200 90', `<path fill="#0A0C18" fill-opacity=".35" d="${ell(100, 86, 90, 5)}"/>` +
    `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path fill="${body}" d="M12 66 Q10 46 30 42 L60 38 Q74 16 100 14 H136 Q156 14 168 36 L186 42 Q194 46 192 66 Z"/>` +
    `<path fill="${mixColor('#9EE3FF', NIGHT_700, 0.55)}" d="M70 38 Q80 22 100 21 H112 V38 Z M118 21 H134 Q148 22 158 38 H118 Z"/></g>` +
    `<path fill="none" stroke="${mixColor(c, '#FFFFFF', 0.6)}" stroke-width="2.4" stroke-linecap="round" d="M30 48 H180"/>` +
    `${wheel(48)}${wheel(156)}<path fill="${GOLD_HI}" d="M14 48 h8 v8 h-8 Z"/><path fill="${GUN}" d="M184 48 h6 v8 h-6 Z"/>` +
    `<path fill="${GOLD_HI}" fill-opacity=".16" d="M14 46 L-24 38 V66 L14 58 Z"/>`, ` data-kind="car"`);
}

/** A passer-by on the far sidewalk: a small cool silhouette with a warm-lit edge, viewBox 0 0 24 60 (feet at 58). */
export function pedSVG(seed = 1) {
  const rnd = mulberry32(fnv1a(`ped:${seed}`));
  const c = mixColor(CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)], NIGHT_500, 0.5);
  const bag = rnd() < 0.4 ? `<path fill="${mixColor(TAKE, NIGHT_500, 0.5)}" d="M17 28 h6 v9 h-6 Z"/>` : '';
  return svg('ped-svg', '0 0 24 60', `<g class="pd-leg-l"><path fill="${NIGHT_700}" d="M7 40 H11 L10 58 H6 Z"/></g><g class="pd-leg-r"><path fill="${NIGHT_700}" d="M13 40 H17 L18 58 H14 Z"/></g>` +
    `<path fill="${c}" d="M5 18 Q6 13 12 13 Q18 13 19 18 L18 42 H6 Z"/>${bag}<path fill="${mixColor('#8A6A5A', NIGHT_500, 0.5)}" d="${ell(12, 8, 5.4, 6)}"/>` +
    `<path fill="none" stroke="${WARM_RIM}" stroke-opacity=".55" stroke-width="1.4" d="M18 16 Q19 28 18 40"/>`, ` data-seed="${seed}"`);
}

// ─── Walkers ──────────────────────────────────────────────────────────────────────────────────
// 14 well-separated clothing colours and 6 cuts; ui.js passes the customer's uid so people next to each other in line
// (consecutive uids) never wear the same colour.
const SHIRTS = ['#E2453C', '#F08A2E', '#F2C230', '#2FA39A', '#3D8BD9', '#6C5CE0', '#D45FA0', '#F2EEE6', '#3A3F4A', '#B5651D',
  '#8FC1EA', '#F6A6B2', '#C9B98A', '#8B2E3C'];
const STYLES = ['tee', 'hoodie', 'jacket', 'collar', 'overall', 'sweater'];
const PANTS = ['#2D3466', '#3B2F5E', '#4A3A30', '#1F2A44', '#6B6F7A', '#5A4A7A', '#355C8C'];
const SHOES = [PAPER, INK, '#C9473E', '#E8D9BC', '#3D8BD9'];
// clothes keep their own warm, saturated colours (art direction 14: the shop's warm look; was backlit toward the night)
const cool = (c) => mixColor(c, '#FFE9C8', 0.94);

export function walkerLook({ cid = 1, visit = 0, oke = null, uid = null } = {}) {
  const rnd = mulberry32(fnv1a(`walker:${cid}:${visit}`));
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const n = uid == null ? Math.floor(rnd() * SHIRTS.length) : (uid * 5 + cid) % SHIRTS.length;
  const shirt = SHIRTS[n];
  const style = uid == null ? pick(STYLES) : STYLES[(uid * 7 + cid * 3) % STYLES.length];
  // a second colour for jackets / overalls / sweater bands, far from the first
  const second = SHIRTS[(n + 5 + Math.floor(rnd() * 4)) % SHIRTS.length];
  const pants = pick(PANTS);
  const shoes = pick(SHOES);
  const stripe = style === 'tee' && rnd() < 0.5;
  const skirt = rnd() < 0.18;
  const b = rnd();
  const bag = b < 0.28 ? 'cross' : b < 0.46 ? 'pack' : null; // a cross-body bag or backpack straps
  const bagC = SHIRTS[(n + 9) % SHIRTS.length];
  return { shirt, second, style, pants, shoes, stripe, skirt, oke: !!oke, bag, bagC };
}

// the picture-only fan sign: a cardboard placard with a red heart and a tea cup with a jagged shout burst
const SIGN = `<g class="wk-sign" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">` +
  `<path fill="none" d="M62 300 L70 -40 M138 300 L130 -40"/>` +
  `<path fill="${PAPER}" d="M14 -150 H186 V-30 H14 Z"/>` +
  `<path fill="${GUN}" d="M40 -100 C40 -122 70 -124 72 -102 C74 -124 104 -122 104 -100 C104 -76 72 -60 72 -54 C72 -60 40 -76 40 -100 Z"/>` +
  `<path fill="#C8915C" d="M120 -120 H160 L154 -50 H126 Z"/><path fill="none" d="M116 -120 H164 M146 -120 L154 -140"/>` +
  `<path fill="${LEMON}" stroke-width="3" d="M166 -104 L178 -112 L176 -98 L186 -92 L174 -88 L176 -74 L166 -84 Z"/></g>`;

// the cut on top of the torso (drawn over the shirt; the outline comes from the body group)
function cut(L, shirt, second) {
  const s2 = cool(second);
  switch (L.style) {
    case 'hoodie': return `<path fill="${warmShade(shirt)}" d="M70 200 Q66 176 84 172 L100 186 L116 172 Q134 176 130 200 Q116 210 100 206 Q84 210 70 200 Z"/>` +
      `<path fill="none" stroke-width="3" d="M92 208 V236 M108 208 V236"/><path fill="${warmShade(shirt)}" stroke-width="3" d="M70 300 H130 L124 330 H76 Z"/>`;
    case 'jacket': return `<path fill="${s2}" stroke="none" d="M86 198 H114 L110 348 H90 Z"/><path fill="none" stroke-width="3.4" d="M86 198 L92 348 M114 198 L108 348"/>` +
      `<path fill="${warmShade(shirt)}" stroke-width="3" d="M84 198 L72 236 L88 232 Z M116 198 L128 236 L112 232 Z"/>`;
    case 'collar': return `<path fill="${PAPER}" stroke-width="3" d="M84 196 L100 214 L90 228 L78 206 Z M116 196 L100 214 L110 228 L122 206 Z"/>` +
      `<path fill="${INK}" stroke="none" d="${ell(100, 248, 3, 3)} ${ell(100, 274, 3, 3)} ${ell(100, 300, 3, 3)}"/>`;
    case 'overall': return `<path fill="${cool('#355C8C')}" stroke-width="3.4" d="M70 270 H130 L134 348 H66 Z"/><path fill="${cool('#355C8C')}" stroke-width="3" d="M74 200 L84 200 L84 270 L74 270 Z M116 200 L126 200 L126 270 L116 270 Z"/>` +
      `<path fill="${LEMON}" stroke-width="2.4" d="${ell(79, 262, 4, 4)} ${ell(121, 262, 4, 4)}"/><path fill="none" stroke-width="3" d="M86 296 H114 V318 H86 Z"/>`;
    case 'sweater': return `<path fill="${s2}" stroke="none" d="M52 262 H148 L147 292 H53 Z"/><path fill="none" stroke="${PAPER}" stroke-width="3.4" stroke-linejoin="round" d="M54 277 L66 268 L78 284 L90 268 L102 284 L114 268 L126 284 L138 268 L146 277"/>` +
      `<path fill="none" stroke-width="3" d="M84 200 Q100 212 116 200"/>`;
    default: return L.stripe ? `<path fill="none" stroke="${mixColor(shirt, '#FFFFFF', 0.55)}" stroke-width="10" d="M54 256 H146 M53 290 H147"/>` : `<path fill="none" stroke-width="3" d="M86 200 Q100 210 114 200"/>`;
  }
}

/** The picture set a person uses (pics.js, docs/art-ai-brief.md) or null (drawn): a 奧客's own 'oke-<type>', a content
 *  customer's 'cust-<cid>', else one of the regulars 'reg-<n>' picked by uid. A 奧客 without its own picture stays drawn
 *  (it has to be recognisable). */
export function walkerPicName({ cid = 1, oke = null, uid = null, fixed } = {}) {
  const o = oke || (fixed === 'c250' ? 'c250' : null);
  if (o) return hasPic(`oke-${o}`) ? `oke-${o}` : null;
  if (hasPic(`cust-${cid}`)) return `cust-${cid}`;
  const regs = picIds().filter((k) => /^reg-\d+$/.test(k)).sort((a, b) => a.slice(4) - b.slice(4));
  return regs.length ? regs[(((uid == null ? cid : uid) * 7 + cid) % regs.length + regs.length) % regs.length] : null;
}

// a person as pictures: front (px-base), happy, mad (sent off), back; the far silhouette is the front picture's shape
// filled with the night colour (an alpha mask), faded in by --far like the drawn one
function walkerPicSVG(name, cid) {
  const vb = [0, 0, 200, 480];
  const href = picSrc(name).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const sil = `<mask id="pm-${name}" mask-type="alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="480">` +
    `<image href="${href}" x="0" y="0" width="200" height="480" preserveAspectRatio="xMidYMax meet"/></mask>` +
    `<rect class="wk-sil" x="0" y="0" width="200" height="480" fill="${NIGHT_500}" mask="url(#pm-${name})"/>`;
  return picSet(name, svg('walker-svg', vb.join(' '), '', ` data-cid="${cid}"`), ['happy', 'mad', 'back'],
    { before: `<path class="wk-shadow" fill="${G.ao}" stroke="none" d="${ell(100, 476, 70, 12)}"/>`, after: sil + SIGN });
}

export function walkerSVG({ cid = 1, visit = 0, fixed, oke = null, uid = null } = {}) {
  const P = walkerPicName({ cid, oke, uid, fixed });
  if (P) return walkerPicSVG(P, cid);
  const L = walkerLook({ cid, visit, oke, uid });
  const shirt = cool(L.shirt);
  const pants = cool(L.pants);
  const look = customerLook({ id: cid }, visit, fixed);
  const skin = mixColor(look.skin, NIGHT_500, 0.94); // hands and neck in the face's own skin tone
  const hairBack = mixColor(look.hairC, NIGHT_900, 0.9);
  const head = customerSVG({ id: cid }, visit, fixed ? { fixed } : {}).replace('<svg class="cust"', '<svg class="cust" x="0" y="0" width="200" height="200"');
  const c250 = fixed === 'c250' || oke === 'c250';
  const shoeC = L.shoes;
  // the right-hand parts are the left ones mirrored about x 100
  const MIRROR = 'matrix(-1 0 0 1 200 0)';
  // legs: trousers tapering to a rolled cuff, a crease, chunky sneakers (sole band, toe cap, laces)
  const leg = (side) => {
    const l = side === 'l';
    const fill = l ? pants : warmShade(pants);
    const cuff = mixColor(pants, '#FFFFFF', 0.16);
    const sole = mixColor(PAPER, '#C9A88A', 0.82);
    const toe = mixColor(shoeC, '#FFFFFF', 0.35);
    const g = `<path fill="${fill}" d="M58 334 H100 L97 440 H64 Q59 392 58 334 Z"/>` +
      `<path fill="${cuff}" stroke-width="3.4" d="M63 428 H98 L97 444 H64 Z"/>` +
      `<path fill="none" stroke-width="2.4" stroke-opacity=".45" d="M80 352 L81 420"/>` +
      `<path fill="${shoeC}" d="M60 440 H98 Q107 448 106 462 Q105 470 96 471 H52 Q43 470 45 461 Q48 448 60 440 Z"/>` +
      `<path fill="${toe}" stroke-width="3" d="M45 461 Q47 452 58 451 Q64 458 62 470 H52 Q43 470 45 461 Z"/>` +
      `<path fill="${sole}" stroke-width="3.4" d="M44 464 Q45 476 56 477 H96 Q107 476 106 464 Q100 470 92 470 H56 Q48 470 44 464 Z"/>` +
      `<path fill="none" stroke="${PAPER}" stroke-width="2.6" d="M74 448 L88 446 M72 455 L88 453"/>`;
    return `<g class="wk-leg wk-leg-${side}">${l ? g : `<g transform="${MIRROR}">${g}</g>`}</g>`;
  };
  // arms: bent at the elbow, a sleeve (short for tees and overalls, long with a cuff otherwise), a mitten hand with a thumb
  const short = L.style === 'tee' || L.style === 'overall';
  const sleeveC = shirt;
  const arm = (side) => {
    const l = side === 'l';
    const sl = l ? sleeveC : warmShade(sleeveC);
    const sk = l ? skin : warmShade(skin);
    const hand = `<path fill="${sk}" d="M38 318 Q33 338 46 343 Q59 345 61 330 L58 316 Z"/>` +
      `<path fill="${sk}" stroke-width="3.4" d="M56 321 Q65 318 66 327 Q65 335 57 334"/>`;
    const fore = `<path fill="${sk}" d="M36 256 L31 278 Q29 292 35 306 L39 320 Q48 325 59 319 L57 300 Q52 288 54 274 L58 260 Z"/>`;
    const g = short
      ? fore + `<path fill="${sl}" d="M66 208 Q43 211 37 240 L33 262 Q46 271 59 264 L63 244 Z"/>` +
        `<path fill="none" stroke-width="2.4" stroke-opacity=".5" d="M38 256 Q47 262 58 258"/>` + hand
      : `<path fill="${sl}" d="M66 208 Q43 211 37 240 L31 276 Q29 290 35 304 L39 316 Q48 321 59 315 L57 298 Q52 287 54 273 L63 244 Z"/>` +
        `<path fill="${mixColor(sleeveC, '#FFFFFF', 0.14)}" stroke-width="3.4" d="M37 304 L39 318 Q48 324 59 317 L57 303 Q47 309 37 304 Z"/>` +
        `<path fill="none" stroke-width="2.4" stroke-opacity=".45" d="M34 268 Q43 274 53 266 M40 236 Q46 240 52 236"/>` + hand;
    return `<g class="wk-arm wk-arm-${side}">${l ? g : `<g transform="${MIRROR}">${g}</g>`}` +
      (l ? '' : `<path class="wk-ticket" fill="${LEMON}" d="M150 300 L184 306 L180 330 L146 324 Z"/>`) + '</g>';
  };
  const torso = L.skirt
    ? 'M52 236 Q50 208 84 200 L116 200 Q150 208 148 236 L146 300 L164 372 Q100 386 36 372 L54 300 Z'
    : 'M52 236 Q50 208 84 200 L116 200 Q150 208 148 236 L146 340 Q100 352 54 340 Z';
  const hemD = L.skirt ? 'M40 360 Q100 374 160 360 L164 372 Q100 386 36 372 Z' : 'M54 328 Q100 340 146 328 L146 340 Q100 352 54 340 Z';
  // a bag: a cross-body strap with a small flap bag at the hip, or backpack straps over both shoulders
  const bagC = cool(L.bagC);
  const bag = c250 ? '' : L.bag === 'cross'
    ? `<path fill="none" stroke="${INK}" stroke-width="11" d="M66 206 L140 310"/><path fill="none" stroke="${bagC}" stroke-width="5.4" d="M66 206 L140 310"/>` +
      `<path fill="${bagC}" stroke-width="3.6" d="M122 302 H160 Q164 302 164 306 V330 Q164 336 158 336 H124 Q118 336 118 330 V306 Q118 302 122 302 Z"/>` +
      `<path fill="${warmShade(bagC)}" stroke-width="3" d="M118 306 Q118 300 124 300 H158 Q164 300 164 306 L162 318 H120 Z"/><path fill="${LEMON}" stroke-width="2" d="M138 314 H144 V322 H138 Z"/>`
    : L.bag === 'pack'
      ? `<path fill="${bagC}" stroke-width="3.4" d="M68 206 L78 204 L76 300 L66 300 Z M132 206 L122 204 L124 300 L134 300 Z"/>` +
        `<path fill="${STEEL}" stroke-width="2.4" d="M66 276 H78 V284 H66 Z M122 276 H134 V284 H122 Z"/>`
      : '';
  const sil = (c) => `<g class="wk-sil" stroke="none"><g transform="matrix(.88 0 0 .88 12 57.1)"><path fill="${mixColor(L.shirt, NIGHT_500, 0.5)}" d="${torso} M37 240 L31 304 Q40 326 59 318 L63 244 Z M163 240 L169 304 Q160 326 141 318 L137 244 Z"/>` +
    `<path fill="${mixColor(L.pants, NIGHT_700, 0.45)}" d="M58 334 H142 L136 476 H48 Z M88 182 H112 V206 H88 Z"/></g>` +
    `<g transform="matrix(1.12 0 0 1.12 -12 16)"><path fill="${mixColor('#8A6A5A', NIGHT_500, 0.45)}" d="${ell(100, 108, 80, 90)}"/>` +
    `<path fill="none" stroke="${RIM}" stroke-width="7" stroke-opacity=".85" stroke-linecap="round" d="M34 96 Q48 22 104 18"/></g>${c}</g>`;
  // the 250-cup customer: an order list as long as she is, rolled at the top, held at the chest, curling on the floor
  const LIST_ROWS = Array.from({ length: 13 }, (_, i) => 288 + i * 13).map((y, i) => `M${i % 3 === 2 ? 140 : 138} ${y} H${i % 2 ? 166 : 172}`).join(' ');
  const list = c250
    ? `<g class="wk-list" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round">` +
      `<path fill="${PAPER}" d="M132 254 H180 L178 330 Q174 380 180 430 L178 462 Q160 470 132 464 Q128 420 134 380 Q130 320 132 254 Z"/>` +
      `<path fill="${PAPER_SH}" stroke="none" d="M164 256 H180 L178 330 Q174 380 180 430 L178 462 Q172 466 164 466 Q168 420 166 380 Q162 320 164 256 Z"/>` +
      `<path fill="none" stroke="${mixColor(INK, PAPER, 0.6)}" stroke-width="2.6" d="${LIST_ROWS}"/>` +
      `<text x="156" y="282" font-family="'Baloo 2', 'Noto Sans TC', sans-serif" font-weight="800" font-size="22" text-anchor="middle" fill="${GUN}" stroke="none">250</text>` +
      `<path fill="${PAPER}" d="M128 462 Q126 478 146 478 H186 Q196 476 192 466 Q186 458 176 462 Q172 470 178 472"/>` +
      `<path fill="${PAPER}" d="M126 244 H184 Q190 244 190 251 Q190 258 184 258 H126 Q120 258 120 251 Q120 244 126 244 Z"/>` +
      `<path fill="none" stroke="${PAPER_SH}" stroke-width="3" d="M128 249 H182"/>` +
      `<path fill="${skin}" d="M176 246 Q184 236 192 244 Q196 256 186 262 L178 258 Z"/></g>`
    : '';
  // her right arm bends out to hold the list's roll; the other arm hangs as usual
  const holdArm = c250
    ? `<g class="wk-arm wk-arm-r"><path fill="${warmShade(shirt)}" d="M134 206 Q160 210 167 232 L172 242 Q178 248 184 246 L188 258 Q174 266 163 258 Q152 246 146 236 Z"/>` +
      `<path fill="none" stroke-width="2.4" stroke-opacity=".45" d="M160 232 Q166 238 170 232"/></g>`
    : '';
  const BODY_T = 'matrix(.88 0 0 .88 12 57.1)';
  const HEAD_T = 'matrix(1.12 0 0 1.12 -12 16)';
  const parts = [
    `<path class="wk-shadow" fill="${G.ao}" stroke="none" d="${ell(100, 474, 72, 12)}"/>`,
    `<g transform="${BODY_T}">`,
    `<g class="wk-body" stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">`,
    arm('l'),
    leg('l'), leg('r'),
    `<path fill="${shirt}" d="${torso}"/>`,
    `<path fill="${warmShade(shirt)}" fill-opacity=".7" stroke="none" d="M122 203 Q148 209 148 236 L146 340 Q134 346 120 348 Q132 290 122 203 Z"/>`,
    // soft volume: the torso as a cylinder lit from the upper left
    `<path fill="url(#gkCylSoft)" stroke="none" d="${torso}"/>`,
    // the hem band and two side folds at the waist
    L.style === 'overall' ? '' : `<path fill="${warmShade(shirt)}" fill-opacity=".55" stroke-width="3.4" d="${hemD}"/>`,
    `<path fill="none" stroke-width="2.4" stroke-opacity=".45" d="M62 292 Q68 306 63 322 M138 292 Q132 306 137 322 M96 214 Q100 222 104 214"/>`,
    // a warm rim on the shoulders: the shop light in front of them
    `<path fill="none" stroke="${WARM_RIM}" stroke-opacity=".55" stroke-width="5" d="M60 220 Q68 204 86 202"/>`,
    cut(L, shirt, L.second),
    bag,
    oke ? `<path fill="${LEMON}" stroke-width="3" d="M86 226 L98 214 L110 226 L104 246 H92 Z"/>` : '',
    `<path fill="${skin}" d="M88 182 H112 V204 Q100 212 88 204 Z"/>`,
    `<path fill="url(#gkShade)" stroke="none" d="${kEll(100, 192, 20, 9)}"/>`,
    c250 ? holdArm : `<g class="wk-arm-rest">${arm('r')}</g>`,
    `<g class="wk-phone"><path fill="${warmShade(shirt)}" d="M138 206 Q166 196 170 164 L172 128 Q172 118 162 118 Q152 118 152 128 L150 162 Q146 182 136 192 Z"/>` +
      `<path fill="${skin}" d="${ell(162, 118, 11, 11)}"/><rect x="146" y="70" width="30" height="48" rx="5" fill="${NIGHT_700}"/><rect x="151" y="76" width="20" height="32" fill="#9EE3FF"/>` +
      `<path fill="${GUN}" stroke="none" d="${ell(161, 113, 2.6, 2.6)}"/></g>`,
    '</g>',
    list,
    '</g>',
    `<g transform="${HEAD_T}">`,
    head,
    // soft volume on the face: cheek blush, a hair highlight from the key light (the cartoon face stays as it is)
    `<g class="wk-vol" stroke="none"><path fill="url(#gkBlush)" d="${kEll(66, 152, 14, 8)} ${kEll(134, 152, 14, 8)}"/>` +
      `<path fill="url(#gkHi)" fill-opacity=".55" d="${kEll(80, 54, 30, 13)}"/></g>`,
    // back view (walking away): the back of the head in the hair colour over the face, a collar seam
    `<g class="wk-back" stroke="${INK}" stroke-width="5" stroke-linejoin="round"><path fill="${hairBack}" d="M38 120 Q36 46 100 40 Q164 46 162 120 Q160 178 128 194 Q100 204 72 194 Q40 178 38 120 Z"/>` +
      `<path fill="none" stroke="${mixColor(hairBack, '#FFFFFF', 0.75)}" stroke-width="4" stroke-linecap="round" d="M70 64 Q100 50 130 64"/>` +
      `<path fill="${skin}" d="M86 192 Q100 200 114 192 V206 Q100 212 86 206 Z"/></g>`,
    '</g>',
    SIGN,
    // far silhouette: the same shapes, flat cool colours, no outline, a cool rim on top
    sil(''),
  ];
  const n = parts.length;
  const drawn = softLine(parts.slice(1, n - 2).join('')); // not the contact shadow, the sign or the silhouette
  return svg('walker-svg', '0 0 200 480', parts[0] + drawn + parts.slice(n - 2).join(''), ` data-cid="${cid}" data-style="${L.style}"`);
}

// ─── Staff and shop props ─────────────────────────────────────────────────────────────────────
/** The part-timer, a bust behind the front worktop (viewBox 0 0 142 166, fully inside): red cap (Lv2: a gold star),
 *  apron, both hands at the cup they are making (ui.js lays the cup over the hands). */
export function helperSVG(level = 1) {
  // drawn like the customers and the clerk (art direction 14): soft coloured outlines (softLine), warm shading, the shop
  // uniform (a plum polo, the red apron with a stitched pocket and a pen, a name badge), the red cap
  const visit = level === 2 ? 1 : 0;
  const skin = customerLook({ id: 'staff' }, visit).skin || '#F2C7A0';
  const U = '#4E3668';                       // the polo, a warm plum (the clerk's uniform family)
  const A = GUN;                             // the apron
  const torso = 'M16 166 Q18 116 50 106 H92 Q124 116 126 166 Z';
  // the head as a group (a nested <svg> would be resized by page CSS such as `.st svg { width: 100% }`)
  const head = customerSVG({ id: 'staff' }, visit, {}).replace(/^<svg class="cust"[^>]*>/, '<g class="cust" transform="translate(23 14) scale(.48)">').replace(/<\/svg>$/, '</g>');
  const body = [
    `<g stroke="${INK}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">`,
    `<path fill="${U}" d="${torso}"/>`,
    `<path fill="${warmShade(U)}" fill-opacity=".7" stroke="none" d="M100 110 Q124 118 126 166 H104 Q108 136 100 110 Z"/>`,
    `<path fill="url(#gkCylSoft)" stroke="none" d="${torso}"/>`,
    // the polo collar points and a warm rim of shop light on the left shoulder
    `<path fill="${mixColor(U, '#FFFFFF', 0.8)}" stroke-width="2.4" d="M58 106 L52 118 L66 114 Z M84 106 L90 118 L76 114 Z"/>`,
    `<path fill="none" stroke="${WARM_RIM}" stroke-opacity=".6" stroke-width="4" d="M24 132 Q30 114 48 108"/>`,
    // the apron: bib with straps, stitched top edge, a pocket with a pen, the shop's white cup mark (no words)
    `<path fill="${A}" d="M46 112 H96 L102 166 H40 Z"/>`,
    `<path fill="${warmShade(A)}" fill-opacity=".6" stroke="none" d="M86 112 H96 L102 166 H92 Z"/>`,
    `<path fill="none" stroke="${GUN_DEEP}" stroke-width="3.4" d="M48 112 L42 102 M94 112 L100 102"/>`,
    `<path fill="none" stroke="${PAPER}" stroke-opacity=".75" stroke-width="1.6" stroke-dasharray="3 3" d="M50 117 H92"/>`,
    `<path fill="${mixColor(A, GUN_DEEP, 0.6)}" stroke-width="2.4" d="M56 140 H86 V158 Q71 162 56 158 Z"/>`,
    `<path fill="none" stroke="${PAPER}" stroke-opacity=".7" stroke-width="1.4" stroke-dasharray="2.6 2.6" d="M59 143 H83 V155.4 Q71 158.6 59 155.4 Z"/>`,
    `<path fill="${STEEL_HI}" stroke-width="1.8" d="M78 132 h4 v10 h-4 Z"/><path fill="#3D8BD9" stroke-width="1.8" d="M77.6 128 h4.8 v5 h-4.8 Z"/>`,
    `<path fill="${PAPER}" stroke="none" d="M66 122 H76 L75 130 H67 Z"/>`,
    // the name badge with a gold clip
    `<path fill="${PAPER}" stroke-width="2" d="M30 124 h14 v8 h-14 Z"/><path fill="${LEMON}" stroke-width="1.6" d="M34 121 h6 v4 h-6 Z"/>`,
    `<path fill="${skin}" d="M60 98 H82 V112 Q71 118 60 112 Z"/>`,
    `<path fill="url(#gkShade)" stroke="none" d="${kEll(71, 104, 12, 5)}"/>`,
    // arms forward to the cup: plum sleeves, hands in the face's own skin tone
    `<path fill="${U}" d="M22 134 Q12 148 30 156 L56 150 L54 138 Z"/>`,
    `<path fill="${warmShade(U)}" d="M120 134 Q130 148 112 156 L86 150 L88 138 Z"/>`,
    `<path fill="${skin}" d="${ringPath(56, 148, 7)}"/><path fill="${warmShade(skin)}" d="${ringPath(86, 148, 7)}"/>`,
    '</g>',
    head,
    `<g stroke="none"><path fill="url(#gkBlush)" d="${kEll(55, 89, 7, 4)} ${kEll(89, 89, 7, 4)}"/></g>`,
    // the cap (Lv2: a gold star on it): crown with a seam and a button, a curved brim, a soft highlight
    `<path fill="${GUN}" stroke="${INK}" stroke-width="3" stroke-linejoin="round" d="M38 46 Q42 14 72 14 Q102 14 106 46 Q72 38 38 46 Z"/>`,
    `<path fill="${warmShade(GUN)}" stroke="${INK}" stroke-width="3" stroke-linejoin="round" d="M98 42 Q118 40 128 48 Q110 52 96 48 Z"/>`,
    `<path fill="none" stroke="${GUN_DEEP}" stroke-width="2" d="M72 15 Q66 28 64 41 M72 15 Q80 28 84 41"/>`,
    `<path fill="${GUN_DEEP}" d="${ringPath(72, 15, 3)}"/>`,
    `<path fill="url(#gkHi)" stroke="none" d="${kEll(56, 26, 12, 6)}"/>`,
    level >= 2 ? `<path fill="${LEMON}" stroke="${INK}" stroke-width="2" stroke-linejoin="round" d="M72 18 L76 27 L85 27 L78 32 L81 41 L72 36 L63 41 L66 32 L59 27 L68 27 Z"/>` : '',
  ];
  return svg('helper-svg', '0 0 142 166', softLine(body.join('')), ` data-level="${level}"`);
}

export function acSVG() {
  return svg('ac-svg', '0 0 160 60', `<g stroke="${INK_BG}" stroke-width="2.4" stroke-linejoin="round">` +
    `<path fill="${PAPER}" d="M6 4 H154 Q158 4 158 8 V40 Q158 46 152 46 H8 Q2 46 2 40 V8 Q2 4 6 4 Z"/>` +
    `<path fill="${PAPER_SH}" stroke="none" d="M2 32 H158 V40 Q158 46 152 46 H8 Q2 46 2 40 Z"/>` +
    `<path fill="none" d="M14 38 H146 M14 42 H146"/><path fill="${RIM}" stroke="none" d="${ell(140, 14, 3, 3)}"/></g>` +
    `<path class="ac-air" fill="none" stroke="${RIM}" stroke-width="3" stroke-linecap="round" stroke-opacity=".7" d="M30 52 q10 6 0 12 M70 52 q10 6 0 12 M110 52 q10 6 0 12"/>`);
}

export function speakerSVG() {
  return svg('speaker-svg', '0 0 60 84', `<g stroke="${INK_BG}" stroke-width="2.4" stroke-linejoin="round">` +
    `<path fill="${NIGHT_700}" d="M6 2 H54 Q58 2 58 6 V78 Q58 82 54 82 H6 Q2 82 2 78 V6 Q2 2 6 2 Z"/>` +
    `<path fill="${STEEL_LO}" d="${ell(30, 56, 18, 18)}"/><path fill="${NIGHT_900}" d="${ell(30, 56, 8, 8)}"/>` +
    `<path fill="${STEEL_LO}" d="${ell(30, 20, 9, 9)}"/><path fill="${LEMON}" stroke="none" d="${ell(30, 20, 3, 3)}"/></g>` +
    `<path class="sp-wave" fill="none" stroke="${LEMON}" stroke-width="3" stroke-linecap="round" d="M64 40 q8 16 0 32 M72 32 q12 24 0 48"/>`);
}

export function ticketMachineSVG() {
  return svg('ticket-machine-svg', '0 0 90 100', `<g stroke="${INK_BG}" stroke-width="2.4" stroke-linejoin="round">` +
    `<path fill="${GUN}" d="M10 20 Q10 12 18 12 H72 Q80 12 80 20 V92 H10 Z"/><path fill="${GUN_DEEP}" stroke="none" d="M60 13.4 H72 Q78.6 13.4 78.6 20 V90.6 H60 Z"/>` +
    `<path fill="${NIGHT_900}" d="M20 24 H70 V48 H20 Z"/>` +
    `<path fill="${LEMON}" d="M28 60 H62 L66 96 H24 Z"/><path fill="none" stroke-width="1.6" d="M30 72 H60 M30 82 H60"/></g>` +
    `<text x="45" y="43" font-family="'DSEG7 Classic', monospace" font-size="17" text-anchor="middle" fill="${GUN}">250</text>`);
}

export function rotateIconSVG() {
  return svg('rotate-svg', '0 0 120 120', `<g fill="none" stroke="${PAPER}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">` +
    `<rect x="38" y="14" width="44" height="76" rx="8" transform="rotate(-90 60 60)" stroke="${LEMON}"/>` +
    `<rect x="44" y="20" width="32" height="64" rx="5" stroke-opacity=".35"/>` +
    `<path d="M22 70 A40 40 0 0 1 40 26"/><path d="M30 24 L42 24 L40 36"/>` +
    `<path d="M98 50 A40 40 0 0 1 80 94"/><path d="M90 96 L78 96 L80 84"/></g>`);
}
