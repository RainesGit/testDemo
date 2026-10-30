// art-clerk.js — the clerk for the shop's cut-in panel (gameplay v3): the v2 clerk (../art.js CLERK_SVG, same moods,
// arms and CSS hooks) with the shop's extra detail laid over it: soft volume on the uniform, shoulder seams and folds,
// the polo placket, a stitched apron pocket with a pen, a clip on the name badge, cheek blush and a second hair shine.
// The v2 game keeps the plain CLERK_SVG. Pure strings; needs the shop's shared gradients (art-kit.js SHOP_DEFS).
//
//   shopClerkSVG() → svg string (class "clerk", data-mood like CLERK_SVG)

import { CLERK_SVG, PALETTE, mixColor } from '../art.js';

const { INK, GUN, GUN_DEEP, PAPER, STEEL, LEMON } = PALETTE;
const UNIFORM_LINE = mixColor(INK, '#3A2F63', 0.5);

// over the body, under the neck and head (inserted where the c-body group ends)
const BODY = [
  // the uniform as a soft cylinder lit from the upper left
  `<path fill="url(#gkCylSoft)" stroke="none" d="M14 330 L30 230 Q46 202 112 192 L130 214 L148 192 Q214 202 230 230 L246 330 Z"/>`,
  // shoulder seams and two folds at the sides
  `<path fill="none" stroke="${UNIFORM_LINE}" stroke-width="3" d="M50 212 Q62 236 58 266 M210 212 Q198 236 202 266 M38 292 Q50 304 42 322 M222 292 Q210 304 218 322"/>`,
  // the polo placket and its two buttons between the collar points
  `<path fill="none" stroke="${UNIFORM_LINE}" stroke-width="3" d="M130 214 V228"/>`,
  `<path fill="${PAPER}" stroke="${INK}" stroke-width="2" d="M126 219 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z"/>`,
  // apron: a light edge on the left, stitching along the top, a pocket with a pen
  `<path fill="#FFFFFF" fill-opacity=".18" stroke="none" d="M86 228 H98 L90 330 H76 Z"/>`,
  `<path fill="none" stroke="${PAPER}" stroke-opacity=".7" stroke-width="2" stroke-dasharray="5 5" d="M90 236 H170"/>`,
  `<path fill="${mixColor(GUN, GUN_DEEP, 0.7)}" stroke="${INK}" stroke-width="3" d="M104 286 H156 V316 Q130 322 104 316 Z"/>`,
  `<path fill="none" stroke="${PAPER}" stroke-opacity=".7" stroke-width="2" stroke-dasharray="4 4" d="M108 291 H152 V312 Q130 317 108 312 Z"/>`,
  `<path fill="${STEEL}" stroke="${INK}" stroke-width="2.4" d="M140 281 h7 v18 h-7 Z"/><path fill="#3D8BD9" stroke="${INK}" stroke-width="2.4" d="M139.5 274 h8 v8 h-8 Z"/>`,
  // a gold clip on the name badge and a shine on it
  `<path fill="${LEMON}" stroke="${INK}" stroke-width="2.4" d="M124 238 h12 v9 h-12 Z"/>`,
  `<path fill="none" stroke="#FFFFFF" stroke-opacity=".8" stroke-width="2.4" d="M108 249 H120"/>`,
].join('');

// on the face, after its highlight: cheek blush; on the hair: a second, smaller shine
const BLUSH = `<path fill="url(#gkBlush)" stroke="none" d="M76 152 a16 8 0 1 0 32 0 a16 8 0 1 0 -32 0 Z M154 152 a16 8 0 1 0 32 0 a16 8 0 1 0 -32 0 Z"/>`;
const SHINE = `<path fill="none" stroke="#FFFFFF" stroke-opacity=".35" stroke-width="3" stroke-linecap="round" d="M176 54 Q186 64 190 78"/>`;

let cached = null;
export function shopClerkSVG() {
  if (cached) return cached;
  let s = CLERK_SVG;
  const bodyEnd = s.indexOf('</g>', s.indexOf('<g class="c-body">'));
  if (bodyEnd > 0) s = s.slice(0, bodyEnd) + BODY + s.slice(bodyEnd);
  s = s.replace(/(<path class="c-skin-hi"[^>]*\/>)/, `$1${BLUSH}`);
  s = s.replace(/(<\/g>\s*<g class="a a-rest-l">)/, `${SHINE}$1`);
  cached = s;
  return s;
}
