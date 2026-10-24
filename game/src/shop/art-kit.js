// art-kit.js — the depth kit of the landscape shop art (docs/art-direction-v2.md 13): one warm key light from the upper
// left, the camera tilted ~35° down onto the work table. Every prop is a flat base colour plus shared shading overlays
// (gradients in objectBoundingBox units, so one definition fits every shape and every colour), soft contact shadows done
// as radial gradients (never filters), thin outlines in a darker shade of the prop's own colour.
// The gradients live ONCE per page in SHOP_DEFS (ui.js puts it at the top of the stage; demo pages do the same); props
// reference them by id (url(#gk…)). Pure strings, no DOM.
//
//   SHOP_DEFS                    <svg class="shop-defs"> with every shared gradient (insert once per document)
//   G                            gradient references: G.cyl (cylinder body: highlight band left, core shadow right, warm rim),
//                                G.top (a horizontal face: lighter at the back-left), G.front (a vertical front face),
//                                G.box (a diagonal block face), G.sph (sphere), G.ao (contact shadow), G.inner (the inside of
//                                a container seen from above), G.glass (clear plastic: refraction edges), G.liquid (a drink
//                                behind the plastic), G.spec (a specular streak), G.steel / G.steelTop / G.chrome (metal fills),
//                                G.wood, G.blush / G.hi / G.shade (soft round spots for faces), G.glow (a warm light pool)
//   ell(cx, cy, rx, ry)          an ellipse as a path
//   ao(cx, cy, rx, ry)           a soft contact shadow under a prop; cast(cx, cy, rx, ry) its longer shadow to the lower right
//   over(d, g, op?)              the same path again with a shading overlay
//   line(c, k = .55)             the thin outline colour of a fill c (c darkened)
//   lit(c, k), dark(c, k)        lighter / darker versions of a colour (mixColor towards warm white / cool dark)
//   r1(n)                        rounded to 0.1
import { mixColor } from '../art.js';

export const r1 = (n) => Math.round(n * 10) / 10;
export const ell = (cx, cy, rx, ry) => `M${r1(cx - rx)} ${r1(cy)} a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(2 * rx)} 0 a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(-2 * rx)} 0`;
export const lit = (c, k = 0.35) => mixColor(c, '#FFF6E2', 1 - k);
export const dark = (c, k = 0.3) => mixColor(c, '#241A30', 1 - k);
export const line = (c, k = 0.55) => mixColor(c, '#2A1C24', 1 - k);

export const G = {
  cyl: 'url(#gkCyl)', cylSoft: 'url(#gkCylSoft)', top: 'url(#gkTop)', front: 'url(#gkFront)', box: 'url(#gkBox)', sph: 'url(#gkSph)',
  ao: 'url(#gkAO)', inner: 'url(#gkInner)', glass: 'url(#gkGlass)', liquid: 'url(#gkLiquid)', spec: 'url(#gkSpec)', steel: 'url(#gkSteel)',
  steelTop: 'url(#gkSteelTop)', chrome: 'url(#gkChrome)', wood: 'url(#gkWood)', blush: 'url(#gkBlush)', hi: 'url(#gkHi)', shade: 'url(#gkShade)',
  glow: 'url(#gkGlow)', rim: 'url(#gkRim)', foam: 'url(#gkFoam)',
};

export const ao = (cx, cy, rx, ry) => `<path fill="${G.ao}" d="${ell(cx, cy, rx, ry)}"/>`;
/** A soft cast shadow thrown to the lower right (the key light is upper left) under a prop that stands rx wide. */
export const cast = (cx, cy, rx, ry) => `<path fill="${G.ao}" fill-opacity=".75" d="${ell(cx + rx * 0.45, cy - ry * 0.1, rx * 1.1, ry * 1.25)}"/>`;
export const over = (d, g, op = 1) => `<path fill="${g}"${op < 1 ? ` fill-opacity="${op}"` : ''} d="${d}"/>`;

const stop = (o, c, a = 1) => `<stop offset="${o}" stop-color="${c}"${a < 1 ? ` stop-opacity="${a}"` : ''}/>`;
const W = '#FFFFFF';
const K = '#140C1C';
const WARM = '#FFE2A8';

export const SHOP_DEFS = '<svg class="shop-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>' +
  // a vertical cylinder lit from the upper left: a soft rim on the far left, the highlight band, the core shadow, a warm bounce
  `<linearGradient id="gkCyl" x1="0" y1="0" x2="1" y2="0">${stop(0, K, 0.22)}${stop(0.07, W, 0.12)}${stop(0.2, W, 0.5)}${stop(0.32, W, 0.1)}${stop(0.55, K, 0.02)}${stop(0.8, K, 0.3)}${stop(0.93, K, 0.22)}${stop(1, WARM, 0.4)}</linearGradient>` +
  `<linearGradient id="gkCylSoft" x1="0" y1="0" x2="1" y2="0">${stop(0, K, 0.1)}${stop(0.22, W, 0.3)}${stop(0.45, W, 0)}${stop(0.82, K, 0.18)}${stop(1, WARM, 0.25)}</linearGradient>` +
  // a horizontal face seen from above: the back-left catches the light, the front-right falls off
  `<linearGradient id="gkTop" x1="0" y1="0" x2=".6" y2="1">${stop(0, W, 0.45)}${stop(0.5, W, 0.06)}${stop(1, K, 0.16)}</linearGradient>` +
  `<linearGradient id="gkFront" x1="0" y1="0" x2="0" y2="1">${stop(0, W, 0.22)}${stop(0.35, W, 0)}${stop(1, K, 0.3)}</linearGradient>` +
  `<linearGradient id="gkBox" x1="0" y1="0" x2="1" y2="1">${stop(0, W, 0.38)}${stop(0.45, W, 0)}${stop(1, K, 0.3)}</linearGradient>` +
  `<radialGradient id="gkSph" cx=".36" cy=".3" r=".8">${stop(0, W, 0.75)}${stop(0.28, W, 0.08)}${stop(0.62, K, 0.05)}${stop(1, K, 0.45)}</radialGradient>` +
  // the soft contact shadow under everything (ambient occlusion)
  `<radialGradient id="gkAO" cx=".5" cy=".5" r=".5">${stop(0, K, 0.62)}${stop(0.45, K, 0.34)}${stop(1, K, 0)}</radialGradient>` +
  // inside a container seen from above: the back wall shades the back of the floor
  `<linearGradient id="gkInner" x1="0" y1="0" x2="0" y2="1">${stop(0, K, 0.5)}${stop(0.45, K, 0.12)}${stop(1, K, 0)}</linearGradient>` +
  // clear plastic: bright refraction edges, a clear middle, a cool tint
  `<linearGradient id="gkGlass" x1="0" y1="0" x2="1" y2="0">${stop(0, '#BFE4F4', 0.55)}${stop(0.07, W, 0.6)}${stop(0.16, W, 0.12)}${stop(0.5, '#DDF2FB', 0.04)}${stop(0.82, W, 0.1)}${stop(0.92, W, 0.5)}${stop(1, '#7FAAC2', 0.45)}</linearGradient>` +
  // a drink behind the plastic: darker at both edges (the wall bends the light), a light core
  `<linearGradient id="gkLiquid" x1="0" y1="0" x2="1" y2="0">${stop(0, K, 0.28)}${stop(0.18, K, 0.02)}${stop(0.36, W, 0.18)}${stop(0.55, W, 0.02)}${stop(0.85, K, 0.2)}${stop(1, K, 0.38)}</linearGradient>` +
  `<linearGradient id="gkSpec" x1="0" y1="0" x2="1" y2="0">${stop(0, W, 0)}${stop(0.5, W, 0.9)}${stop(1, W, 0)}</linearGradient>` +
  // metal fills
  `<linearGradient id="gkSteel" x1="0" y1="0" x2="1" y2="0">${stop(0, '#8E97A6')}${stop(0.16, '#F5F7FA')}${stop(0.32, '#CBD1DA')}${stop(0.62, '#AAB2BE')}${stop(0.86, '#78808F')}${stop(1, '#B4BBC6')}</linearGradient>` +
  `<linearGradient id="gkSteelTop" x1="0" y1="0" x2=".5" y2="1">${stop(0, '#FBFCFD')}${stop(0.55, '#D6DBE2')}${stop(1, '#AEB5C0')}</linearGradient>` +
  `<linearGradient id="gkChrome" x1="0" y1="0" x2="0" y2="1">${stop(0, '#FFFFFF')}${stop(0.4, '#C9CFD8')}${stop(0.55, '#8A93A1')}${stop(1, '#D9DEE5')}</linearGradient>` +
  `<linearGradient id="gkWood" x1="0" y1="0" x2="0" y2="1">${stop(0, '#EDBE7E')}${stop(0.45, '#C98A4B')}${stop(1, '#8A5529')}</linearGradient>` +
  // soft round spots: a cheek blush, a highlight, a shadow
  `<radialGradient id="gkBlush" cx=".5" cy=".5" r=".5">${stop(0, '#FF6F7D', 0.55)}${stop(1, '#FF6F7D', 0)}</radialGradient>` +
  `<radialGradient id="gkHi" cx=".5" cy=".5" r=".5">${stop(0, W, 0.7)}${stop(1, W, 0)}</radialGradient>` +
  `<radialGradient id="gkShade" cx=".5" cy=".5" r=".5">${stop(0, K, 0.42)}${stop(1, K, 0)}</radialGradient>` +
  `<radialGradient id="gkGlow" cx=".5" cy=".5" r=".5">${stop(0, '#FFD98A', 0.55)}${stop(0.5, '#FFD98A', 0.18)}${stop(1, '#FFD98A', 0)}</radialGradient>` +
  `<linearGradient id="gkRim" x1="0" y1="0" x2="0" y2="1">${stop(0, WARM, 0.7)}${stop(1, WARM, 0)}</linearGradient>` +
  `<radialGradient id="gkFoam" cx=".4" cy=".35" r=".7">${stop(0, '#FFFFFF')}${stop(0.6, '#FFF4DA')}${stop(1, '#EED9A8')}</radialGradient>` +
  '</defs></svg>';
