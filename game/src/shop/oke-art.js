// oke-art.js — the 奧客 request bubble (what each pest wants, drawn as a prop, never as words) and small shop props:
// the number ticket, the stamp mark, the fan sign, star pips. Pure SVG strings (no DOM).
//   okeBubbleSVG(prop) → <svg class="oke-bubble" data-prop>, viewBox 0 0 120 100 (same box as orderBubbleSVG)
//   STAMP_SVG, starRowSVG(stars, max = 5)

const INK = '#1B1311';
const PAPER = '#FFF7E6';
const GUN = '#EE4130';
const SHUT = '#7658F2';
const TAKE = '#FFC21A';
const LEMON = '#FFD84A';
const ICE = '#E6F6FF';
const ICE_EDGE = '#86BCD8';
const STEEL = '#BCC3CE';
const PINK = '#FF8FC1';

const ring = (cx, cy, r) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
const NUM = `font-family="'Baloo 2', sans-serif" font-weight="800"`;

// a jagged "this person is trouble" bubble
const SHAPE = 'M14 8 L30 4 L44 9 L60 3 L76 9 L92 4 L108 10 L114 26 L110 42 L116 58 L106 76 L88 78 L70 82 L48 78 L36 80 L22 97 L24 78 L8 72 L10 54 L4 38 L10 22 Z';

const PROPS = {
  // 一杯就好: one tiny cup, a raised index finger
  one: `<path fill="#DDEFF7" stroke="${INK}" stroke-width="2.4" d="M28 30 H46 L43 66 H31 Z"/><path fill="#C8915C" d="M29.4 42 H44.6 L43 66 H31 Z"/>` +
    `<text x="78" y="64" ${NUM} font-size="46" text-anchor="middle" fill="${INK}">1</text>`,
  // 250 杯客: a number ticket "250" with a red round stamp on it (the answer is to stamp it: 收)
  c250: `<path fill="${INK}" fill-opacity=".2" d="M22 26 H90 V76 H22 Z" transform="translate(3 3) rotate(-6 56 51)"/>` +
    `<g transform="rotate(-6 56 51)"><path fill="${PAPER}" stroke="${INK}" stroke-width="2.6" d="M22 26 H90 V76 H22 Z"/><path fill="${TAKE}" d="M22 26 H90 V36 H22 Z"/>` +
    `<path fill="none" stroke="${INK}" stroke-width="2.6" d="M22 36 H90"/><text x="56" y="68" ${NUM} font-size="30" text-anchor="middle" fill="${INK}">250</text></g>` +
    `<circle cx="92" cy="70" r="15" fill="${GUN}" fill-opacity=".9" stroke="${INK}" stroke-width="2.4"/><circle cx="92" cy="70" r="10" fill="none" stroke="${PAPER}" stroke-width="2" stroke-dasharray="3 2"/>`,
  // 試喝: a cup and a sticking-out tongue
  taste: `<path fill="#DDEFF7" stroke="${INK}" stroke-width="2.4" d="M22 24 H48 L44 70 H26 Z"/><path fill="#C8915C" d="M23.6 36 H46.4 L44 70 H26 Z"/>` +
    `<path fill="${INK}" d="M64 36 Q82 30 98 36 Q96 46 81 48 Q66 46 64 36 Z"/><path fill="${PINK}" stroke="${INK}" stroke-width="2.2" d="M72 44 Q81 46 90 44 Q92 64 81 66 Q70 64 72 44 Z"/><path fill="none" stroke="${INK}" stroke-width="1.6" d="M81 48 V60"/>`,
  // 少冰: an ice cube and a minus
  lessIce: `<path fill="${ICE}" stroke="${ICE_EDGE}" stroke-width="2.4" d="M26 26 L54 22 L58 52 L30 56 Z"/><path fill="#FFFFFF" d="M31 30 L40 29 L41 36 L32 37 Z"/>` +
    `<path fill="${SHUT}" stroke="${INK}" stroke-width="2" d="M70 36 H102 V46 H70 Z"/>`,
  // 插隊: an arrow jumping over two heads
  cutIn: `<path fill="#3B2F5E" d="${ring(40, 60, 9)} ${ring(64, 60, 9)}"/><path fill="#3B2F5E" d="M28 76 Q40 66 52 76 Z M52 76 Q64 66 76 76 Z"/>` +
    `<path fill="none" stroke="${GUN}" stroke-width="5" stroke-linecap="round" d="M96 56 Q70 10 26 40"/><path fill="${GUN}" d="M18 44 L34 30 L36 48 Z"/>`,
  // 自備水桶: a bucket
  bucket: `<path fill="#4E8FD6" stroke="${INK}" stroke-width="2.6" d="M30 30 H90 L82 74 H38 Z"/><path fill="#7FB4EA" d="M34 34 H86 L85 40 H35 Z"/>` +
    `<path fill="none" stroke="${INK}" stroke-width="2.6" d="M30 30 Q60 0 90 30"/>`,
  // 講電話: a phone with sound waves
  phone: `<rect x="40" y="16" width="28" height="56" rx="6" fill="#2D3466" stroke="${INK}" stroke-width="2.6"/><rect x="44" y="24" width="20" height="36" fill="#9EE3FF"/>` +
    `<path fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" d="M76 30 Q84 44 76 58 M84 24 Q96 44 84 64"/>`,
  // 網紅直播: a phone on a selfie stick, the red live dot
  live: `<path fill="none" stroke="${STEEL}" stroke-width="5" stroke-linecap="round" d="M40 80 L64 36"/><rect x="56" y="14" width="40" height="28" rx="5" fill="#2D3466" stroke="${INK}" stroke-width="2.6" transform="rotate(-12 76 28)"/>` +
    `<circle cx="70" cy="28" r="6" fill="${GUN}" stroke="${INK}" stroke-width="1.6"/>`,
};

export function okeBubbleSVG(prop) {
  const body = PROPS[prop] || PROPS.one;
  const gold = prop === 'c250';
  return `<svg class="oke-bubble" viewBox="0 0 120 100" overflow="visible" aria-hidden="true" data-prop="${prop}">` +
    `<path fill="${INK}" fill-opacity=".25" d="${SHAPE}" transform="translate(0 3)"/>` +
    `<path fill="${gold ? LEMON : PAPER}" stroke="${gold ? INK : GUN}" stroke-width="3" stroke-linejoin="round" d="${SHAPE}"/>` +
    body + '</svg>';
}

export const STAMP_SVG = `<svg class="stamp-svg" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="${GUN}" stroke-width="8" stroke-dasharray="6 3"/>` +
  `<circle cx="50" cy="50" r="28" fill="${GUN}" fill-opacity=".85"/><text x="50" y="60" ${NUM} font-size="28" text-anchor="middle" fill="${PAPER}">250</text></svg>`;

export function starRowSVG(stars, max = 5) {
  const pts = (cx) => `M${cx} 2 L${cx + 4.1} 10.6 L${cx + 13.5} 11.6 L${cx + 6.5} 18 L${cx + 8.4} 27.4 L${cx} 22.6 L${cx - 8.4} 27.4 L${cx - 6.5} 18 L${cx - 13.5} 11.6 L${cx - 4.1} 10.6 Z`;
  let s = '';
  for (let i = 0; i < max; i++) {
    const on = i < stars;
    s += `<path class="star${on ? ' on' : ''}" fill="${on ? LEMON : 'none'}" stroke="${on ? INK : 'rgb(255 247 230 / .45)'}" stroke-width="2.4" stroke-linejoin="round" ${on ? '' : 'stroke-dasharray="3 2"'} d="${pts(15 + i * 30)}"/>`;
  }
  return `<svg class="stars-svg" viewBox="0 0 150 30" aria-hidden="true" data-stars="${stars}">${s}</svg>`;
}
