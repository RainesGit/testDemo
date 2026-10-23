// art-street.js — gameplay v3 landscape art outside the work table (docs/gameplay-v3-shop.md 10.1–10.3, 10.7):
// the night street in perspective, the corner building people walk out from behind, full-body walkers (heads from
// art.js customerSVG + simple bodies), the part-timer, and the shop-front upgrade props. Pure SVG strings, seeded
// (same input → same output), no DOM, no filters / blur / images. Palette tokens from art.js (docs/art-direction-v2.md
// 2.1): the street is cool and backlit, warm light only spills from the shop.
//
//   streetSVG({ neon, rail })   <svg class="street-svg">, viewBox 0 0 1280 342 (stage design px; layout.js geometry):
//                               sky, far buildings, road, our sidewalk; neon = the neon-sign upgrade on the far side,
//                               rail = queue stanchions along the line (layout.streetPoint)
//   cornerSVG()                 <svg class="corner-svg">, same viewBox: the near corner building (drawn over walkers)
//   awningSVG()                 <svg class="awning-svg">, viewBox 0 0 1280 40: the shop's striped valance from inside
//   walkerSVG({ cid, visit, fixed, oke })   <svg class="walker-svg">, viewBox 0 0 200 480 (feet at 100, 476): legs
//                               g.wk-leg-l/r, arms g.wk-arm-l/r (swing in CSS), g.wk-phone (a fan filming), g.wk-sign
//                               (the picture-only fan sign), g.wk-ticket (walking off with the 250 ticket), g.wk-sil
//                               (the far, outline-free silhouette; CSS fades it by distance), the head svg.cust
//   helperSVG(level)            <svg class="helper-svg">, viewBox 0 0 170 172: the part-timer behind the table
//   acSVG(), speakerSVG(), ticketMachineSVG(), rotateIconSVG()   shop props and the rotate-your-phone icon
import { PALETTE, mixColor, celShade, ringPath, mulberry32, fnv1a, customerSVG } from '../art.js';
import { streetPoint } from './layout.js';

const { INK, INK_BG, PAPER, PAPER_SH, GUN, GUN_DEEP, SHUT, TAKE, LEMON, GOLD_HI, RIM, NIGHT_900, NIGHT_700, NIGHT_500,
  STEEL_HI, STEEL, STEEL_LO, COUNTER_HI, COUNTER, COUNTER_LO, WARM_RIM } = PALETTE;
const PINK = '#FF8FC1';
const WINDOW = '#FFD98A';
const r1 = (n) => Math.round(n * 10) / 10;
const svg = (cls, vb, body, attrs = '') => `<svg class="${cls}" viewBox="${vb}" overflow="visible" aria-hidden="true"${attrs}>${body}</svg>`;
const ell = (cx, cy, rx, ry) => `M${r1(cx - rx)} ${r1(cy)} a${rx} ${ry} 0 1 0 ${r1(2 * rx)} 0 a${rx} ${ry} 0 1 0 ${r1(-2 * rx)} 0`;
const V = { x: -300, y: 150 };
// a line through the vanishing point: y at x for a line that is at y0 at x = 1280
const persp = (y0, x) => V.y + ((y0 - V.y) * (x - V.x)) / (1280 - V.x);

// ─── The street ────────────────────────────────────────────────────────────────────────────────
function farBuildings() {
  const rnd = mulberry32(fnv1a('street'));
  const fills = ['#2A2F5A', '#332B55', '#252A4E', '#3A3160', '#2D3466'];
  const signs = [GUN, SHUT, LEMON, RIM, PINK, TAKE];
  let out = '';
  let lit = '';
  let dark = '';
  let glow = '';
  let x = 1300;
  let i = 0;
  while (x > 40) {
    const k = (x - V.x) / (1280 - V.x);
    const w = (120 + rnd() * 90) * k;
    const h = (95 + rnd() * 80) * k;
    const base = persp(166, x);
    const x0 = x - w;
    out += `<path fill="${fills[i % fills.length]}" d="M${r1(x0)} ${r1(base)} V${r1(base - h)} H${r1(x)} V${r1(base)} Z"/>`;
    // roof line + a cool rim on the left edge (backlit by the sky glow)
    out += `<path fill="none" stroke="${RIM}" stroke-opacity=".28" stroke-width="${r1(2 * k)}" d="M${r1(x0)} ${r1(base)} V${r1(base - h)} H${r1(x)}"/>`;
    // windows
    const ww = 9 * k;
    const wh = 11 * k;
    for (let wy = base - h + 12 * k; wy < base - 34 * k; wy += 20 * k) {
      for (let wx = x0 + 10 * k; wx < x - 14 * k; wx += 18 * k) {
        const d = `M${r1(wx)} ${r1(wy)} h${r1(ww)} v${r1(wh)} h${r1(-ww)} Z `;
        if (rnd() < 0.42) lit += d; else dark += d;
      }
    }
    // the ground floor shop: a glowing front + a blank sign panel in a shop colour
    const sc = signs[Math.floor(rnd() * signs.length)];
    glow += `<path fill="${WINDOW}" fill-opacity=".5" d="M${r1(x0 + 6 * k)} ${r1(base - 22 * k)} H${r1(x - 6 * k)} V${r1(base)} H${r1(x0 + 6 * k)} Z"/>`;
    glow += `<path fill="${sc}" fill-opacity=".85" d="M${r1(x0 + 8 * k)} ${r1(base - 31 * k)} H${r1(x - 8 * k)} V${r1(base - 24 * k)} H${r1(x0 + 8 * k)} Z"/>`;
    x = x0 - 4 * k;
    i++;
  }
  return out + `<path fill="${WINDOW}" fill-opacity=".78" d="${lit}"/><path fill="${NIGHT_900}" fill-opacity=".55" d="${dark}"/>` + glow;
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

export function streetSVG({ neon = false, rail = false } = {}) {
  const roadFar = (x) => persp(170, x);
  const roadNear = (x) => persp(226, x);
  const body = [
    `<defs><linearGradient id="stSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NIGHT_900}"/><stop offset=".7" stop-color="${NIGHT_700}"/><stop offset="1" stop-color="#3A3466"/></linearGradient>`,
    `<radialGradient id="stPool" cx="820" cy="360" r="560" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${WARM_RIM}" stop-opacity=".42"/><stop offset=".55" stop-color="${WARM_RIM}" stop-opacity=".1"/><stop offset="1" stop-color="${WARM_RIM}" stop-opacity="0"/></radialGradient></defs>`,
    `<rect x="0" y="0" width="1280" height="190" fill="url(#stSky)"/>`,
    // a thin moon and a few stars
    `<path fill="${GOLD_HI}" fill-opacity=".8" d="M612 40 a14 14 0 1 0 14 18 a11 11 0 1 1 -14 -18 Z"/>`,
    `<path fill="${PAPER}" fill-opacity=".6" d="${[[180, 34], [330, 18], [520, 52], [700, 22], [860, 44], [1180, 30], [1050, 14]].map(([x, y]) => ell(x, y, 1.6, 1.6)).join(' ')}"/>`,
    farBuildings(),
    neon ? neonSign() : '',
    // far sidewalk, road with a dashed centre line, a zebra crossing near the corner
    `<path fill="#4A4568" d="M0 ${r1(persp(166, 0))} L1280 166 L1280 ${r1(roadFar(1280))} L0 ${r1(roadFar(0))} Z"/>`,
    `<path fill="#232640" d="M0 ${r1(roadFar(0))} L1280 ${r1(roadFar(1280))} L1280 ${r1(roadNear(1280))} L0 ${r1(roadNear(0))} Z"/>`,
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
    // our sidewalk: tiles in perspective, a curb, the warm spill from the shop
    `<path fill="#4E4A6C" d="M0 ${r1(roadNear(0))} L1280 ${r1(roadNear(1280))} L1280 342 L0 342 Z"/>`,
    sidewalkLines(),
    `<path fill="none" stroke="#8E88B0" stroke-width="3" d="M0 ${r1(roadNear(0))} L1280 ${r1(roadNear(1280))}"/>`,
    `<path fill="none" stroke="#2A2742" stroke-width="2" d="M0 ${r1(roadNear(0) + 3)} L1280 ${r1(roadNear(1280) + 3)}"/>`,
    `<rect x="0" y="150" width="1280" height="192" fill="url(#stPool)"/>`,
    // a street lamp on the far curb
    `<path fill="none" stroke="${NIGHT_500}" stroke-width="4" d="M760 ${r1(roadFar(760))} V92 Q760 82 772 82 H790"/><path fill="${GOLD_HI}" d="M784 80 h16 l-3 7 h-10 Z"/>` +
      `<path fill="${GOLD_HI}" fill-opacity=".12" d="M792 88 L760 ${r1(roadNear(760))} L840 ${r1(roadNear(840))} Z"/>`,
    rail ? stanchions() : '',
  ];
  return svg('street-svg', '0 0 1280 342', body.join(''), ` preserveAspectRatio="none" data-neon="${neon ? 1 : 0}" data-rail="${rail ? 1 : 0}"`);
}

export function cornerSVG() {
  // the near corner building at the far end of the line: people walk out from behind its edge (x ≈ 74)
  const base = 252;
  const body = [
    `<path fill="${COUNTER}" d="M-20 20 H70 L74 ${base} H-20 Z"/>`,
    `<path fill="${celShade(COUNTER)}" d="M44 20 H70 L74 ${base} H46 Z"/>`,
    `<path fill="none" stroke="${RIM}" stroke-opacity=".55" stroke-width="2.4" d="M70 20 L74 ${base}"/>`,
    // lit shop window and a blank vertical sign
    `<path fill="${WINDOW}" fill-opacity=".55" d="M-20 172 H40 V${base - 6} H-20 Z"/>`,
    `<path fill="${COUNTER_LO}" d="M-20 164 H44 V172 H-20 Z"/>`,
    `<path fill="${GUN}" stroke="${INK_BG}" stroke-width="2" d="M6 46 H30 V140 H6 Z"/>`,
    `<path fill="${PAPER}" fill-opacity=".9" d="M11 60 H25 L23 84 H13 Z M9 58 H27 V61 H9 Z M18 58 L22 50 L24 51 L20 58 Z"/>`,
    `<path fill="${LEMON}" d="M10 100 C10 94 18 93 18 99 C18 93 26 94 26 100 C26 107 18 112 18 114 C18 112 10 107 10 100 Z"/>`,
    `<path fill="#1B1311" fill-opacity=".35" d="M-20 ${base} H80 L74 ${base + 8} H-20 Z"/>`,
  ];
  return svg('corner-svg', '0 0 1280 342', body.join(''), ' preserveAspectRatio="none"');
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

// ─── Walkers ──────────────────────────────────────────────────────────────────────────────────
const SHIRTS = ['#D9534F', '#4E8FD6', '#E8B04B', '#8E6CCB', '#F2EEE6', '#E07A5F', '#C46B9C', '#5B6CB0', '#F0A35E', '#B8C2D9'];
const PANTS = ['#2D3466', '#3B2F5E', '#4A3A30', '#1F2A44', '#6B6F7A', '#5A4A7A'];
const SHOES = [PAPER, INK, '#C9473E', '#E8D9BC'];
const cool = (c) => mixColor(c, NIGHT_500, 0.84); // backlit on the night street (art direction 5.2)

export function walkerLook({ cid = 1, visit = 0, oke = null } = {}) {
  const rnd = mulberry32(fnv1a(`walker:${cid}:${visit}`));
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const shirt = oke ? pick(['#D9534F', '#C46B9C', '#E8B04B', '#8E6CCB']) : pick(SHIRTS);
  return { shirt, pants: pick(PANTS), shoes: pick(SHOES), stripe: rnd() < 0.3, skirt: rnd() < 0.2 };
}

// the picture-only fan sign: a cardboard placard with a red heart and a tea cup with a jagged shout burst
const SIGN = `<g class="wk-sign" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">` +
  `<path fill="none" d="M62 300 L70 -40 M138 300 L130 -40"/>` +
  `<path fill="${PAPER}" d="M14 -150 H186 V-30 H14 Z"/>` +
  `<path fill="${GUN}" d="M40 -100 C40 -122 70 -124 72 -102 C74 -124 104 -122 104 -100 C104 -76 72 -60 72 -54 C72 -60 40 -76 40 -100 Z"/>` +
  `<path fill="#C8915C" d="M120 -120 H160 L154 -50 H126 Z"/><path fill="none" d="M116 -120 H164 M146 -120 L154 -140"/>` +
  `<path fill="${LEMON}" stroke-width="3" d="M166 -104 L178 -112 L176 -98 L186 -92 L174 -88 L176 -74 L166 -84 Z"/></g>`;

export function walkerSVG({ cid = 1, visit = 0, fixed, oke = null } = {}) {
  const L = walkerLook({ cid, visit, oke });
  const shirt = cool(L.shirt);
  const pants = cool(L.pants);
  const skin = cool('#F2C7A0');
  const head = customerSVG({ id: cid }, visit, fixed ? { fixed } : {}).replace('<svg class="cust"', '<svg class="cust" x="0" y="0" width="200" height="200"');
  const leg = (side) => {
    const l = side === 'l';
    const d = l ? 'M58 338 H99 L95 452 H64 Z' : 'M101 338 H142 L136 452 H105 Z';
    const shoe = l ? 'M60 446 H97 Q104 468 92 474 H52 Q46 466 60 446 Z' : 'M104 446 H141 Q150 466 144 474 H104 Q98 466 104 446 Z';
    return `<g class="wk-leg wk-leg-${side}"><path fill="${l ? pants : celShade(pants)}" d="${d}"/><path fill="${L.shoes}" d="${shoe}"/></g>`;
  };
  const arm = (side) => {
    const l = side === 'l';
    const d = l ? 'M62 206 Q40 212 37 242 L35 300 Q35 312 47 312 Q58 312 58 300 L62 246 Z' : 'M138 206 Q160 212 163 242 L165 300 Q165 312 153 312 Q142 312 142 300 L138 246 Z';
    return `<g class="wk-arm wk-arm-${side}"><path fill="${l ? shirt : celShade(shirt)}" d="${d}"/><path fill="${skin}" d="${ell(l ? 47 : 153, 318, 11, 11)}"/>` +
      (l ? '' : `<path class="wk-ticket" fill="${LEMON}" d="M150 300 L184 306 L180 330 L146 324 Z"/>`) + '</g>';
  };
  const torso = L.skirt
    ? 'M50 232 Q52 204 84 198 L116 198 Q148 204 150 232 L148 300 L164 372 Q100 384 36 372 L52 300 Z'
    : 'M50 232 Q52 204 84 198 L116 198 Q148 204 150 232 L146 346 Q100 354 54 346 Z';
  const parts = [
    `<path class="wk-shadow" fill="#0A0C18" fill-opacity=".35" stroke="none" d="${ell(100, 476, 62, 9)}"/>`,
    `<g class="wk-body" stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">`,
    arm('l'),
    leg('l'), leg('r'),
    `<path fill="${shirt}" d="${torso}"/>`,
    `<path fill="${celShade(shirt)}" stroke="none" d="M122 201 Q146 207 150 232 L146 346 Q134 350 120 351 Q132 290 122 201 Z"/>`,
    L.stripe ? `<path fill="none" stroke="${mixColor(shirt, '#FFFFFF', 0.6)}" stroke-width="9" d="M54 262 H146 M53 292 H147"/>` : '',
    oke ? `<path fill="${LEMON}" stroke-width="3" d="M86 226 L98 214 L110 226 L104 246 H92 Z"/>` : '',
    `<path fill="${skin}" d="M88 182 H112 V204 Q100 212 88 204 Z"/>`,
    `<g class="wk-arm-rest">${arm('r')}</g>`,
    `<g class="wk-phone"><path fill="${celShade(shirt)}" d="M138 206 Q166 196 170 164 L172 128 Q172 118 162 118 Q152 118 152 128 L150 162 Q146 182 136 192 Z"/>` +
      `<path fill="${skin}" d="${ell(162, 118, 11, 11)}"/><rect x="146" y="70" width="30" height="48" rx="5" fill="${NIGHT_700}"/><rect x="151" y="76" width="20" height="32" fill="#9EE3FF"/>` +
      `<path fill="${GUN}" stroke="none" d="${ell(161, 113, 2.6, 2.6)}"/></g>`,
    '</g>',
    head,
    SIGN,
    // far silhouette: the same shapes, flat cool colours, no outline, a cool rim on top
    `<g class="wk-sil" stroke="none"><path fill="${mixColor(L.shirt, NIGHT_500, 0.45)}" d="${torso} M37 242 L35 312 H58 L62 246 Z M163 242 L165 312 H142 L138 246 Z"/>` +
      `<path fill="${mixColor(L.pants, NIGHT_700, 0.45)}" d="M58 338 H142 L136 474 H52 Z"/>` +
      `<path fill="${mixColor('#8A6A5A', NIGHT_500, 0.4)}" d="${ell(100, 108, 80, 90)} M88 182 H112 V206 H88 Z"/>` +
      `<path fill="none" stroke="${RIM}" stroke-width="6" stroke-opacity=".7" stroke-linecap="round" d="M34 96 Q48 22 104 18"/></g>`,
  ];
  return svg('walker-svg', '0 0 200 480', parts.join(''), ` data-cid="${cid}"`);
}

// ─── Staff and shop props ─────────────────────────────────────────────────────────────────────
export function helperSVG(level = 1) {
  const skin = '#F2C7A0';
  const head = customerSVG({ id: 'staff' }, level === 2 ? 1 : 0, {}).replace('<svg class="cust"', '<svg class="cust" x="30" y="4" width="110" height="110"');
  const body = [
    `<g stroke="${INK}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">`,
    `<path fill="${PALETTE.COUNTER_HI}" d="M28 172 Q30 120 62 110 H108 Q140 120 142 172 Z"/>`,
    `<path fill="${PAPER}" d="M58 120 H112 L118 172 H52 Z"/><path fill="none" d="M58 120 L50 108 M112 120 L120 108"/>`,
    `<path fill="${GUN}" stroke="none" d="${ringPath(85, 146, 9)}"/>`,
    `<path fill="${skin}" d="M74 100 H96 V116 Q85 122 74 116 Z"/>`,
    // arms forward with a cup
    `<path fill="${PALETTE.COUNTER_HI}" d="M34 140 Q24 150 40 160 L70 156 L68 144 Z M136 140 Q146 150 130 160 L104 156 L106 144 Z"/>`,
    `<path fill="#DDEFF7" d="M72 128 H98 L95 164 H75 Z"/><path fill="#C8915C" stroke="none" d="M73.6 140 H96.4 L95 162.6 H75 Z"/>`,
    `<path fill="${skin}" d="${ringPath(70, 152, 7)} ${ringPath(100, 152, 7)}"/>`,
    '</g>',
    head,
    // the cap (Lv2: a gold star on it)
    `<path fill="${GUN}" stroke="${INK}" stroke-width="3" stroke-linejoin="round" d="M44 40 Q50 6 86 6 Q122 6 128 40 Q86 30 44 40 Z M118 36 Q140 34 150 42 Q130 46 116 42 Z"/>`,
    level >= 2 ? `<path fill="${LEMON}" stroke="${INK}" stroke-width="2" stroke-linejoin="round" d="M86 12 L90 22 L100 22 L92 28 L95 38 L86 32 L77 38 L80 28 L72 22 L82 22 Z"/>` : '',
  ];
  return svg('helper-svg', '0 0 170 172', body.join(''), ` data-level="${level}"`);
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
