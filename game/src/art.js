// art.js — all character, prop and scene art for 《來250杯！》 as SVG / HTML strings.
// Pure string templates: no DOM access, no randomness except seeded (same input -> same output),
// safe to import from node for unit tests. Art direction: docs/art-direction-v2.md (§2 palette / light / line
// weights, §5 characters, §6 scene); styling lives in style.css (scene sections owned by work package A).
//
// Light rule (§2.3): warm light only on the clerk, signs and counter; customers and the queue are backlit (cool).
// Line weights (§2.5): customers 1.2cqw, clerk 1.0 / 0.6cqw (--ink), props 0.45cqw and wall 0.3cqw (--ink-bg),
// queue silhouettes have no outline (0.5cqw cool rim only). Two-step cel shading: shadow = c 72% + #3A2A5A,
// highlight = c 70% + #FFF2C8. No filters, no blur.
//
// ─── Export contract (consumed by ui.js / opening.js) ──────────────────────────────────────────
//   CLERK_SVG : string
//       <svg class="clerk" data-mood="idle">, viewBox -36 -52 332 382 (the counter lip is at y ≈ 319).
//       data-mood = idle|hit|perfect|polite|rage|over. Overlay classes on the <svg>: squint, crack, brow (right brow
//       up), look-down, sigh, tidy (apron tug), point-sign (with mood hit: the right arm points up at the menu box
//       #goldsign), reach (holds up the 250 ticket), stand (rage climb), tap. Badge/ticket text: text.c-badge,
//       text.c-tk. Arms: .a-rest-l .a-rest-r .a-point .a-sign .a-tidy .a-ticket .a-bow .a-up (CSS picks them).
//       The resting hands lie on the counter lip and are drawn in COUNTER_SVG (.ch-l / .ch-r), which must follow
//       the clerk in the DOM (CSS: .clerk[...] ~ .counter .ch-*).
//   SHOP_SVG : string
//       Back wall under a warm pool of light, ceiling, two pendant lamps (.lamp), backlit menu box (3 cells,
//       text.lb-text tspans: name, price), 叫號器 (text#callnum, '000'..'999'), shelves. viewBox 0 0 360 640
//       (1:1 with the 9:16 stage), drawn past the frame (ceiling up, wall down) for the bleed areas; wrap it in
//       <div class="shop">. Hooks: text#goldsign (data-gold on .shop lights the 不能調 cell), stop.wall-hi (the
//       light pool colour; CSS turns it pink while the clerk is forced polite).
//   COUNTER_SVG : string
//       Steel counter top + dark purple acrylic front (drawn down past the frame), 現點現做 acrylic letters,
//       the cool queue silhouettes outside (q-p1..q-p3, near to far; data-q="0".."3" on .counter shows
//       min(queue,3)), the far crowd (q-c1..q-c3, data-crowd="0".."3" = queueCrowd(queue)), the clerk's resting
//       hands (.ch-l, .ch-r). text.q-num / .q-cap stay for old callers but are never shown (§9: no "+N" pill).
//   queueCapText(queue) -> string            '+1,281' style text ('' when queue <= 3)
//   queueCrowd(queue) -> 0..3                far crowd level
//   queueSilhouetteSVG(i) -> string          one queue silhouette (i 0 = nearest) as a full-stage <svg> (bowling pins)
//   customerSVG(customer, visitIndex = 0, { fixed, gray } = {}) -> string
//       <svg class="cust">, viewBox 0 0 200 200 (the boss: 0 0 200 250, head to the chin + collar and tie).
//       Same id+visit -> same look (head shape × eyes × brows × hair × accessories). fixed: 'hesitant' | 'fifteen' |
//       'c250' (also 1|2|3) | 'boss'. gray: true renders the E12 desaturated copy (no CSS filter). Mount as
//       <div class="cust-wrap" data-face=""><div class="cust-clip">SVG</div></div> (.cust-wrap.boss for the boss).
//       Faces (.cust-wrap[data-face]): gun | shut | take | gun2 (charged, flies to the monitor).
//       Other .cust-wrap classes: enter, rise, talk, drift, proud, suck, sink, cower, wobble.
//   signText / signKind / signSVG / miniSign   order signs (unchanged contract, see below)
//   KEY_ICONS, GESTURE_ICONS : { gun, shut, take }   corner badge SVGs (class key-icon)
//   FINGER_SVG, STAR_SVG, DOOR_GATE_SVG, ticketHTML(lines?)
//   MONITOR_SCENES, monitorScene(queue), monitorSVG(queue, lang), monitorHTML(queue, lang)   door monitor
//   ─── shared art for packages B / C (docs/art-direction-v2.md §11) ───
//   LOGO_SVG : string                         <svg class="logo-svg">: backlit acrylic sign 來250杯！ (glyph outlines,
//                                             no font needed); logoSVG(lang) gives the English "250 CUPS!" one.
//                                             Hooks: .lg-sign (the tilted sign), .lg-250 (the gold number),
//                                             .lg-shine (the white glint on 250), .lg-halo (warm glow behind).
//   cupStackSVG(n) -> string                  <svg class="cup-stack-svg" data-n> with n finished cups (0..9) in a
//                                             two-row pyramid, bottom-aligned; g.cs-steam (2 wisps, opacity 0 by
//                                             default) for the fast-mouth steam. cupStackCount(combo) -> 0|3|5|7.
//   MEGAPHONE_SVG : string                    <svg class="prop-svg prop-megaphone">, bell to the right, five volume
//                                             cells rect.mg-bar[data-i="1".."5"]
//   PHONE_SVG : string                        <svg class="prop-svg prop-phone">: incoming call, text.ph-name ('前主管'),
//                                             .ph-ring waves
//   CALCULATOR_SVG : string                   <svg class="prop-svg prop-calculator">: text.calc-num (DSEG7 digits)
//   SLIPS_SVG : string                        <svg class="prop-svg prop-slips">: a stack of order slips
//                                             g.slip[data-i="1".."6"] (bottom to top) and a rubber stamp g.slip-stamp
//   EVENT_PROP_SVG = { megaphone, phone, calculator, stamp }   the four mini-event props by event type
//   PARTICLE_SVG = { ice, pearl, ink, paper, cup }             small particle sprites (class pt-svg)
//   fnv1a(str), mulberry32(seed)              seeded helpers (exported for tests)

// ─── Palette (docs/art-direction-v2.md §2.1; SVG attributes cannot read CSS variables) ───────────
const INK = '#1B1311';
const INK_BG = '#4A2C1C';
const PAPER = '#FFF7E6';
const PAPER_SH = '#EAD8B4';
const GUN = '#EE4130';
const GUN_DEEP = '#B42A1E';
const SHUT = '#7658F2';
const SHUT_DEEP = '#4C34B4';
const TAKE = '#FFC21A';
const TAKE_DEEP = '#DE9800';
const LEMON = '#FFD84A';
const GOLD_HI = '#FFF3B0';
const MINT = '#3CC98E';
const RIM = '#7FD4FF';
const SCREEN = '#9EE3FF';
const NIGHT_900 = '#0E1120';
const NIGHT_700 = '#1B2040';
const NIGHT_500 = '#2D3466';
const WOOD_DK = '#3A2418';
const WOOD_DK_HI = '#55361F';
const STEEL_HI = '#F2F4F7';
const STEEL = '#BCC3CE';
const STEEL_LO = '#737C8C';
const COUNTER_HI = '#3B2F5E';
const COUNTER = '#2A2142';
const COUNTER_LO = '#151026';
const SLAT = '#C7925E';
const SKIN = '#F2C7A0';
const SKIN_SH = '#D99B78';
const HAIR_C = '#241815';
const HAIR_HI = '#5B4038';
const UNIFORM = '#3A2F63';
const UNIFORM_SH = '#2A2149';
const UNIFORM_HI = '#4D4183';
const MOUTH = '#5A1414';
const WARM_RIM = '#FFE6B0';
// drinks (only drinks are green, §2.1)
const DRINK = { milk: '#C89A6A', jade: '#7FD98F', lemon: '#F2D27A', berry: '#E79BB0' };

// ─── Seeded helpers ────────────────────────────────────────────────────────────────────────────
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const r1 = (n) => Math.round(n * 10) / 10;

// Colour mixing (sRGB, precomputed for SVG attributes).
function mix(hex, other, keep) {
  const a = parseInt(hex.slice(1, 7), 16);
  const b = parseInt(other.slice(1, 7), 16);
  return '#' + [16, 8, 0].map((s) => Math.round(((a >> s) & 255) * keep + ((b >> s) & 255) * (1 - keep)).toString(16).padStart(2, '0')).join('').toUpperCase();
}
// §2.4 two-step cel shading: a cool purple shadow and a warm highlight
const shade = (c) => mix(c, '#3A2A5A', 0.72);
const hilite = (c) => mix(c, '#FFF2C8', 0.7);
// §5.2 backlit customers: 10% toward the night
const backlit = (c) => mix(c, NIGHT_900, 0.9);

function grayOf(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const y = Math.round(0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255));
  const h = y.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

const ring = (cx, cy, r) => `M${r1(cx - r)} ${r1(cy)} a${r} ${r} 0 1 0 ${r1(2 * r)} 0 a${r} ${r} 0 1 0 ${r1(-2 * r)} 0`;
const oval = (cx, cy, rx, ry) => `M${r1(cx - rx)} ${r1(cy)} a${rx} ${ry} 0 1 0 ${r1(2 * rx)} 0 a${rx} ${ry} 0 1 0 ${r1(-2 * rx)} 0`;

// ─── Key icons (corner badges; 40-unit box) ─────────────────────────────────────────────────────
const icon = (key, ringC, body) =>
  `<svg class="key-icon ki-${key}" viewBox="0 0 40 40" aria-hidden="true"><g stroke-linejoin="round" stroke-linecap="round">` +
  `<circle cx="20" cy="20" r="17.5" fill="${PAPER}" stroke="${ringC}" stroke-width="3.6"/>${body}</g></svg>`;

export const KEY_ICONS = {
  // door + outward arrow
  gun: icon('gun', GUN,
    `<path fill="none" stroke="${INK}" stroke-width="2.6" d="M11 10 H21 V30 H11 Z"/>` +
    `<path fill="none" stroke="${GUN}" stroke-width="3.6" d="M17 20 H32 M26.5 14.5 L32 20 L26.5 25.5"/>`),
  // mouth crossed out
  shut: icon('shut', SHUT,
    `<path fill="${SHUT}" stroke="${INK}" stroke-width="2.4" d="M8.5 20 Q20 11 31.5 20 Q20 29 8.5 20 Z"/>` +
    `<path fill="none" stroke="${INK}" stroke-width="3.6" d="M12.5 12.5 L27.5 27.5 M27.5 12.5 L12.5 27.5"/>`),
  // number ticket
  take: icon('take', TAKE_DEEP,
    `<path fill="${TAKE}" stroke="${INK}" stroke-width="2.6" d="M9 13 Q9 11 11 11 H29 Q31 11 31 13 V28 Q31 30 29 30 H11 Q9 30 9 28 Z"/>` +
    `<path fill="none" stroke="${INK}" stroke-width="2.6" d="M14 20 H26 M14 25 H22"/><circle cx="20" cy="15" r="1.8" fill="${INK}"/>`),
};

// Gesture icons (gesture mode, docs/gameplay-v2.md 9): the same ringed badge in the key colour, showing the hand
// move instead of the key's picture. 甩 = an up-right fling arrow with speed lines, 連拍 = two small palms,
// 按住蓋章 = a rubber stamp pressing down.
const palm = (x, y, s) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path fill="${PAPER}" stroke="${INK}" stroke-width="2.2" ` +
  `d="M-5 6 V-4 Q-5 -6 -3.4 -6 Q-1.8 -6 -1.8 -4 V-8 Q-1.8 -10 0 -10 Q1.8 -10 1.8 -8 V-4 Q1.8 -6 3.4 -6 Q5 -6 5 -4 V3 Q5 9 0 9 Q-5 9 -5 6 Z"/></g>`;
export const GESTURE_ICONS = {
  gun: icon('gun g-icon', GUN,
    `<path fill="none" stroke="${INK}" stroke-width="2" d="M9 27 H15 M8 22 H13 M11 32 H17" opacity=".7"/>` +
    `<path fill="none" stroke="${GUN}" stroke-width="4" d="M13 29 Q20 26 29 12"/>` +
    `<path fill="${GUN}" stroke="${INK}" stroke-width="1.6" d="M23.5 11 L31 8.5 L30.5 16.5 Z"/>`),
  shut: icon('shut g-icon', SHUT, palm(14, 21, 1.05) + palm(26, 19, 1.05) +
    `<path fill="none" stroke="${SHUT}" stroke-width="2.4" d="M8 9 L10.5 11.5 M20 6 V9.5 M32 9 L29.5 11.5"/>`),
  take: icon('take g-icon', TAKE_DEEP,
    `<path fill="${TAKE}" stroke="${INK}" stroke-width="2.2" d="M16 8 Q16 5 20 5 Q24 5 24 8 Q24 11 22 12 V17 H18 V12 Q16 11 16 8 Z"/>` +
    `<path fill="${GUN}" stroke="${INK}" stroke-width="2.2" d="M10 18 H30 V24 H10 Z"/>` +
    `<path fill="none" stroke="${INK}" stroke-width="2.2" d="M12 29 H28 M16 33 H24"/>`),
};

// ─── Clerk (§5.1) ──────────────────────────────────────────────────────────────────────────────
// Drawn at a scale where the head is ~162 units tall; the viewBox origin is offset so the svg box (66% of the stage
// wide) puts the hair top at y 15% and the counter lip (y ≈ 319 here) on the counter top at y 48%.
// Asymmetric smug face: flat left brow, cocked right brow, half-shut almond eyes looking down-left at the customer,
// a smirk hooking to his left, one-stroke nose, a cowlick and a fringe swept to his left. Light from the upper left:
// shading on the right and below; a warm rim on the hair.
const C_OUT = 5; // 1.0cqw at this scale
const C_IN = 3; // 0.6cqw

const CLERK_MOODS =
  // idle / over: smug
  `<g class="m m-idle">` +
  `<path class="brow-l" fill="none" stroke-width="${C_OUT}" d="M88 105 Q104 100 121 104"/>` +
  `<path class="brow-r" fill="none" stroke-width="${C_OUT}" d="M139 99 Q156 85 173 96"/>` +
  `<g class="eyes"><path fill="#fff" stroke-width="${C_IN}" d="M92 119 H121 Q119 131 106 131 Q93 131 92 119 Z M139 119 H168 Q166 131 153 131 Q140 131 139 119 Z"/>` +
  `<path class="pupils" fill="${INK}" stroke="none" d="${ring(101, 125, 4.6)} ${ring(148, 125, 4.6)}"/>` +
  `<path fill="none" stroke-width="5.5" d="M88 118 H124 M136 117 H172"/></g>` +
  `<path fill="none" stroke-width="4.2" d="M110 163 Q131 168 149 154 L154 151"/>` +
  `</g>` +
  // hit: brows crushed onto the eyes, white eyes, trapezoid mouth with the upper teeth, a vein
  `<g class="m m-hit">` +
  `<path fill="none" stroke-width="7.5" d="M84 94 L122 111 M176 94 L138 111"/>` +
  `<path fill="#fff" stroke-width="${C_IN}" d="M91 114 Q106 104 121 116 Q119 134 105 134 Q90 132 91 114 Z M139 116 Q154 104 169 114 Q170 132 155 134 Q141 134 139 116 Z"/>` +
  `<path fill="${INK}" stroke="none" d="${ring(106, 122, 2.8)} ${ring(154, 122, 2.8)}"/>` +
  `<path fill="${MOUTH}" stroke-width="4.5" d="M98 145 Q130 137 162 145 L156 184 Q130 191 104 184 Z"/>` +
  `<path fill="#fff" stroke-width="${C_IN}" d="M101 146 Q130 140 159 146 L158 155 Q130 150 102 155 Z"/>` +
  `<path fill="${GUN}" stroke="none" d="${oval(130, 178, 15, 6)}"/>` +
  `<path class="vein" fill="none" stroke="${GUN}" stroke-width="4.5" d="M160 52 q5 8 13 5 M183 52 q-8 5 -5 13 M183 76 q-5 -8 -13 -5 M160 76 q8 -5 5 -13"/>` +
  `</g>` +
  // perfect: instantly professional — eyes open, mouth a line, brows flat
  `<g class="m m-calm">` +
  `<path fill="none" stroke-width="${C_OUT}" d="M89 106 H120 M140 106 H171"/>` +
  `<path fill="#fff" stroke-width="${C_IN}" d="M92 121 Q106 109 120 121 Q106 132 92 121 Z M140 121 Q154 109 168 121 Q154 132 140 121 Z"/>` +
  `<path fill="${INK}" stroke="none" d="${ring(106, 121, 5.2)} ${ring(154, 121, 5.2)}"/>` +
  `<path fill="#fff" stroke="none" d="${ring(108, 118.5, 1.8)} ${ring(156, 118.5, 1.8)}"/>` +
  `<path fill="none" stroke-width="4.2" d="M115 161 H147"/>` +
  `</g>` +
  // polite: crescent eyes, a grin far too wide (8 teeth), a sweat drop; .crack cracks the smile
  `<g class="m m-polite">` +
  `<path fill="none" stroke-width="4.5" d="M89 101 Q105 92 120 99 M140 99 Q155 92 171 101"/>` +
  `<path fill="none" stroke-width="5" d="M92 124 Q106 110 120 124 M140 124 Q154 110 168 124"/>` +
  `<path fill="#fff" stroke-width="4" d="M97 145 Q130 141 163 145 Q161 175 130 177 Q99 175 97 145 Z"/>` +
  `<path fill="none" stroke-width="2.2" d="M101 158 H159 M109 146 V172 M119 145 V176 M130 145 V177 M141 145 V176 M151 146 V172"/>` +
  `<path fill="${SCREEN}" stroke-width="${C_IN}" d="M192 58 Q202 74 198 82 Q192 88 186 82 Q182 74 192 58 Z"/>` +
  `<path class="crack" fill="none" stroke-width="${C_IN}" d="M97 138 L105 146 L100 154 L109 162 M163 138 L155 147 L161 155"/>` +
  `</g>` +
  // rage: only whites, jagged teeth, steam from the head, vein
  `<g class="m m-rage">` +
  `<path fill="none" stroke-width="8.5" d="M82 95 L122 112 M178 95 L138 112"/>` +
  `<path fill="#fff" stroke-width="${C_IN}" d="M90 113 Q106 103 122 117 Q118 135 104 135 Q90 133 90 113 Z M138 117 Q154 103 170 113 Q170 133 156 135 Q142 135 138 117 Z"/>` +
  `<path fill="${MOUTH}" stroke-width="4.5" d="M95 145 Q130 135 165 145 Q169 190 130 193 Q91 190 95 145 Z"/>` +
  `<path fill="#fff" stroke-width="2.5" d="M98 147 L105 158 L112 147 L119 158 L126 146 L133 158 L140 147 L147 158 L154 147 L161 157 Q130 138 98 147 Z"/>` +
  `<path class="vein" fill="none" stroke="${GUN}" stroke-width="5" d="M164 46 q5 8 13 5 M187 46 q-8 5 -5 13 M187 70 q-5 -8 -13 -5 M164 70 q8 -5 5 -13"/>` +
  `<path class="steam" fill="${PAPER}" stroke-width="${C_IN}" d="${ring(52, 34, 10)} ${ring(40, 18, 7)} ${ring(34, 4, 5)} ${ring(208, 34, 10)} ${ring(220, 18, 7)} ${ring(226, 4, 5)}"/>` +
  `</g>`;

const CLERK_ARMS =
  // resting arms down to the counter (the hands are on the counter lip, COUNTER_SVG .ch-l / .ch-r)
  `<g class="a a-rest-l"><path fill="${UNIFORM}" d="M32 228 Q14 278 38 326 H98 Q88 276 94 244 Q70 230 32 228 Z"/></g>` +
  `<g class="a a-rest-r"><path fill="${UNIFORM}" d="M228 228 Q246 278 222 326 H162 Q172 276 166 244 Q190 230 228 228 Z"/>` +
  `<path fill="${UNIFORM_SH}" stroke="none" d="M216 246 Q234 286 216 324 H200 Q212 286 207 250 Z"/></g>` +
  // hit: the left arm points at the customer (down left)
  `<g class="a a-point"><path fill="${UNIFORM}" d="M42 222 Q8 234 -12 262 L10 284 Q26 260 64 248 Z"/>` +
  `<path class="c-skin" d="M-16 262 L-46 276 Q-54 282 -46 288 L-10 284 Z ${ring(-6, 272, 15)} Z"/>` +
  `<path fill="none" stroke-width="${C_IN}" d="M-1 262 q8 6 4 14"/></g>` +
  // hit + point-sign: the right arm points up at the menu box (#goldsign)
  `<g class="a a-sign"><path fill="${UNIFORM}" d="M204 232 Q222 176 244 112 L274 122 Q252 196 240 240 Z"/>` +
  `<path class="c-skin" d="M252 94 L270 50 Q276 42 282 50 L272 98 Z M244 104 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0 Z"/></g>` +
  // perfect: one hand tugs the apron straight
  `<g class="a a-tidy"><path fill="${UNIFORM}" d="M228 228 Q250 262 228 300 L190 304 L186 286 L208 280 Q214 258 200 244 Z"/>` +
  `<path class="c-skin" d="${ring(182, 294, 15)}"/></g>` +
  // reach: the 250 number ticket held up at the shoulder
  `<g class="a a-ticket"><path fill="${UNIFORM}" d="M226 228 Q252 214 234 184 L212 190 Q226 210 206 224 Z"/>` +
  `<g transform="rotate(8 228 150)"><rect fill="${LEMON}" stroke-width="4" x="194" y="126" width="68" height="46" rx="6"/>` +
  `<text class="c-tk" x="228" y="159">250</text></g><path class="c-skin" d="${ring(218, 190, 14)}"/></g>` +
  // polite: hands clasped at the chest
  `<g class="a a-bow"><path fill="${UNIFORM}" d="M32 228 Q16 272 74 284 L116 276 L112 256 L80 258 Q62 254 70 236 Z M228 228 Q244 272 186 284 L144 276 L148 256 L180 258 Q198 254 190 236 Z"/>` +
  `<path class="c-skin" d="M106 262 Q130 248 154 262 Q158 284 130 288 Q102 284 106 262 Z"/>` +
  `<path fill="none" stroke-width="${C_IN}" d="M120 262 V282 M130 259 V286 M140 262 V282"/></g>` +
  // rage: both fists up
  `<g class="a a-up"><path fill="${UNIFORM}" d="M44 224 L4 150 L30 136 L80 214 Z M216 224 L256 150 L230 136 L180 214 Z"/>` +
  `<path class="c-skin" d="${ring(16, 140, 17)} ${ring(244, 140, 17)}"/></g>`;

export const CLERK_SVG = `<svg class="clerk" viewBox="-36 -52 332 382" overflow="visible" data-mood="idle" aria-hidden="true">
<g class="c-all" stroke="${INK}" stroke-width="${C_OUT}" stroke-linejoin="round" stroke-linecap="round">
<g class="c-body">
<path fill="${UNIFORM}" d="M14 330 L30 230 Q46 202 112 192 L130 214 L148 192 Q214 202 230 230 L246 330 Z"/>
<path fill="${UNIFORM_SH}" stroke="none" d="M182 206 Q222 220 234 288 L242 330 H202 Q198 258 182 206 Z"/>
<path fill="${UNIFORM_HI}" stroke="none" d="M40 234 Q52 210 92 202 Q60 222 54 250 Z"/>
<path fill="${GUN}" stroke-width="4" d="M86 228 H174 L184 330 H76 Z"/>
<path fill="${GUN_DEEP}" stroke="none" d="M160 230 H172 L182 330 H168 Z"/>
<path fill="none" stroke="${GUN_DEEP}" stroke-width="6" d="M94 228 L113 198 M166 228 L147 198"/>
<path fill="${UNIFORM_HI}" stroke-width="3.5" d="M112 192 L130 214 L118 226 L100 200 Z M148 192 L130 214 L142 226 L160 200 Z"/>
<rect fill="${PAPER}" stroke-width="3" x="103" y="244" width="54" height="25" rx="6"/>
<text class="c-badge" x="130" y="263">250</text>
</g>
<path class="c-skin" stroke-width="4" d="M113 166 V198 Q130 206 147 198 V166 Z"/>
<path class="c-skin-sh" stroke="none" d="M115 172 H145 V190 Q130 196 115 190 Z"/>
<g class="c-head">
<path fill="${HAIR_C}" stroke-width="4.5" d="M60 116 Q46 28 128 22 Q210 24 200 112 Q196 84 184 74 Q160 86 128 80 Q100 94 74 86 Q66 98 60 116 Z"/>
<path class="c-skin" stroke-width="4" d="${ring(70, 120, 13)} ${ring(190, 120, 13)}"/>
<path class="c-skin-sh" stroke="none" d="M184 113 a7 7 0 0 1 9 11 Z"/>
<path class="c-skin" stroke-width="4.5" d="M72 96 Q72 46 130 44 Q188 46 188 96 L185 134 Q176 180 130 184 Q84 180 75 134 Z"/>
<path class="c-skin-sh" stroke="none" d="M186 100 Q188 150 156 180 Q178 152 178 112 Z M76 98 Q100 80 130 82 Q160 80 186 96 L186 106 Q160 92 130 96 Q100 92 76 108 Z"/>
<path class="c-skin-hi" stroke="none" d="M86 132 Q92 150 104 160 Q90 154 84 140 Z"/>
<path class="c-nose" fill="none" stroke-width="${C_IN}" d="M128 134 Q123 148 133 150"/>
${CLERK_MOODS}
<path class="c-bangs" fill="${HAIR_C}" stroke-width="4.5" d="M70 96 Q74 48 130 40 Q182 40 196 88 Q182 68 156 70 Q162 82 152 96 Q134 72 106 78 Q98 86 94 100 Q86 88 70 96 Z"/>
<path fill="${HAIR_C}" stroke-width="4" d="M124 30 Q118 14 141 9 Q133 19 140 30 Z"/>
<path fill="none" stroke="${HAIR_HI}" stroke-width="6" d="M92 44 Q126 28 164 38"/>
<path fill="none" stroke="${HAIR_HI}" stroke-width="3" d="M112 66 Q132 56 150 60"/>
</g>
${CLERK_ARMS}
</g>
</svg>`;

// ─── Customers (§5.2) ──────────────────────────────────────────────────────────────────────────
// Half heads below the counter, looking up at the clerk, backlit: the whole head is 10% toward the night, a warm
// rim on the top of the hair (the shop light from in front of them). Variety comes from head shape × eyes × brows
// × hair × accessories, all from one seed. Never a joke about looks; nobody gets special treatment.
const K_OUT = 5.2; // 1.2cqw at 46cqw for 200 units
const K_IN = 3; // 0.7cqw
const SKINS = ['#F7D7B5', '#EDB98A', '#C98E62', '#8D5A3B']; // looks only; never tied to lines or keys
const HAIRC = [INK, '#4A2E1E', '#8A5A2B', '#BDB6AC'];
const HATC = [GUN, MINT, SHUT, LEMON];

const HEADS = {
  round: 'M100 46 C140 46 164 80 164 120 C164 162 136 194 100 194 C64 194 36 162 36 120 C36 80 60 46 100 46 Z',
  long: 'M100 40 C136 40 158 74 158 116 C158 166 132 198 100 198 C68 198 42 166 42 116 C42 74 64 40 100 40 Z',
  square: 'M100 46 C142 46 164 76 164 112 L162 152 C160 180 136 194 112 196 H88 C64 194 40 180 38 152 L36 112 C36 76 58 46 100 46 Z',
};
const HEAD_KEYS = Object.keys(HEADS);
const EYES = {
  round: { w: `${oval(76, 112, 12, 14)} ${oval(124, 112, 12, 14)}`, p: [[78, 105, 6.5], [126, 105, 6.5]] },
  narrow: { w: 'M63 112 Q76 101 89 112 Q76 120 63 112 Z M111 112 Q124 101 137 112 Q124 120 111 112 Z', p: [[77, 109, 5], [125, 109, 5]] },
  droopy: { w: 'M64 106 Q78 100 90 108 Q90 122 77 123 Q64 122 64 106 Z M110 108 Q122 100 136 106 Q136 122 123 123 Q110 122 110 108 Z', p: [[78, 108, 6], [122, 108, 6]] },
};
const EYE_KEYS = Object.keys(EYES);
const BROWS = {
  flat: 'M60 90 Q74 86 88 89 M112 89 Q126 86 140 90',
  arched: 'M58 94 Q73 80 88 88 M112 88 Q127 80 142 94',
  worried: 'M60 92 Q74 90 88 82 M112 82 Q126 90 140 92',
};
const BROW_KEYS = Object.keys(BROWS);

const HAIR = {
  buzz: (c) => `<path fill="${c}" d="M38 112 Q36 44 100 42 Q164 44 162 112 Q150 70 100 66 Q50 70 38 112 Z"/>`,
  bowl: (c) => `<path fill="${c}" d="M30 104 Q28 30 100 28 Q172 30 170 104 L162 86 H38 Z"/>`,
  part: (c) => `<path fill="${c}" d="M34 130 Q26 36 100 32 Q174 36 166 130 L150 128 Q150 70 104 52 L100 60 L96 52 Q50 70 50 128 Z"/>`,
  bun: (c) => `<path fill="${c}" d="M38 112 Q36 44 100 42 Q164 44 162 112 Q150 70 100 66 Q50 70 38 112 Z ${ring(100, 26, 20)} Z"/>`,
  // one path of overlapping circles (budget: one node instead of eight)
  curly: (c) => `<path fill="${c}" d="${[[40, 98], [44, 66], [64, 42], [92, 30], [122, 32], [148, 44], [160, 70], [162, 100]]
    .map(([x, y]) => `${ring(x, y, 19)}`).join(' ')}"/>`,
  tail: (c) => `<path fill="${c}" d="M34 130 Q26 36 100 32 Q174 36 166 130 L150 128 Q150 70 104 52 L100 60 L96 52 Q50 70 50 128 Z M160 70 Q198 82 190 132 Q180 112 164 104 Z"/>`,
};
const HAIR_KEYS = Object.keys(HAIR);
const HAT_OK = ['buzz', 'part', 'tail'];

const ACC = {
  glasses: () => `<path fill="#fff" fill-opacity=".35" stroke-width="4" d="${ring(76, 110, 18)} ${ring(124, 110, 18)}"/><path fill="none" stroke-width="4" d="M94 108 Q100 102 106 108"/>`,
  cap: (h, g = (c) => c) => `<path fill="${h}" d="M32 96 Q34 30 100 28 Q166 30 168 96 Z M26 92 Q100 64 174 92 Q100 104 26 92 Z"/><path fill="${g(shade(h))}" stroke="none" d="M34 94 Q100 100 166 94 Q100 108 34 94 Z"/>`,
  phones: (h, g = (c) => c) => `<path fill="none" stroke-width="10" d="M30 110 Q30 18 100 18 Q170 18 170 110"/><path fill="${g(shade(h))}" d="M16 96 h24 v36 h-24 Z M160 96 h24 v36 h-24 Z"/>`,
  mask: () => `<path fill="#EAF4F4" d="M36 130 Q100 118 164 130 L160 190 Q100 204 40 190 Z"/>`,
  shades: () => `<path fill="${INK}" d="M52 44 h40 v18 h-40 Z M108 44 h40 v18 h-40 Z"/>`,
  beanie: (h) => `<path fill="${h}" d="M30 96 Q30 20 100 20 Q170 20 170 96 Z"/><rect fill="${h}" x="28" y="80" width="144" height="20" rx="6"/><circle fill="${PAPER}" cx="100" cy="16" r="12"/>`,
};
const ACC_KEYS = Object.keys(ACC);
const HATS = ['cap', 'beanie'];
const HEADWEAR = ['cap', 'beanie', 'phones', 'shades']; // at most one thing on top of the head

const FIXED = {
  hesitant: { hair: 'bowl', acc: ['glasses'], skin: 1, hairC: 0, hatC: 0, head: 'round', eyes: 'round', brows: 'worried' },
  fifteen: { hair: 'buzz', acc: ['cap'], skin: 2, hairC: 1, hatC: 0, head: 'square', eyes: 'narrow', brows: 'flat' },
  c250: { hair: 'tail', acc: ['phones'], skin: 0, hairC: 2, hatC: 0, head: 'long', eyes: 'round', brows: 'arched' },
  boss: { hair: 'slick', acc: ['rimless'], skin: 1, hairC: 0, hatC: 2, head: 'round', eyes: 'droopy', brows: 'stern', boss: true },
};
const FIXED_ALIAS = { 1: 'hesitant', 2: 'fifteen', 3: 'c250' };

/** Pick a customer's look. Pure; exported for tests. */
export function customerLook(customer, visitIndex = 0, fixed) {
  const fk = FIXED[fixed] ? fixed : FIXED_ALIAS[fixed] || (customer && customer.boss ? 'boss' : null);
  if (fk) {
    const f = FIXED[fk];
    return { hair: f.hair, acc: [...f.acc], skin: SKINS[f.skin], hairC: HAIRC[f.hairC], hatC: HATC[f.hatC], head: f.head, eyes: f.eyes, brows: f.brows, fixed: fk };
  }
  const id = customer && customer.id != null ? customer.id : String(customer ?? '');
  const rnd = mulberry32(fnv1a(`${id}:${visitIndex}`));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const skin = pick(SKINS);
  const hairC = pick(HAIRC);
  const hatC = pick(HATC);
  let hair = pick(HAIR_KEYS);
  const r = rnd();
  const count = r < 0.35 ? 0 : r < 0.8 ? 1 : 2;
  const acc = [];
  let guard = 0;
  while (acc.length < count && guard++ < 20) {
    const a = pick(ACC_KEYS);
    if (acc.includes(a)) continue;
    if (HEADWEAR.includes(a) && acc.some((x) => HEADWEAR.includes(x))) continue;
    acc.push(a);
  }
  if (acc.some((a) => HATS.includes(a)) && !HAT_OK.includes(hair)) hair = pick(HAT_OK); // re-draw the hair
  const head = pick(HEAD_KEYS);
  const eyes = pick(EYE_KEYS);
  const brows = pick(BROW_KEYS);
  return { hair, acc, skin, hairC, hatC, head, eyes, brows };
}

function eyesUp(kind) {
  const e = EYES[kind] || EYES.round;
  const pupils = e.p.map(([x, y, r]) => ring(x, y, r)).join(' ');
  const shine = e.p.map(([x, y, r]) => ring(x - r * 0.38, y - r * 0.42, r1(Math.max(1.6, r * 0.42)))).join(' ');
  return `<g class="f-up"><path fill="#fff" stroke-width="${K_IN + 0.6}" d="${e.w}"/>` +
    `<g class="pupils" stroke="none"><path fill="#2A1A12" d="${pupils}"/><path fill="#fff" d="${shine}"/></g></g>`;
}

const FACES =
  // gun: swirl eyes + O mouth
  `<g class="x x-gun"><path fill="#fff" stroke-width="4" d="${ring(74, 112, 14)} ${ring(126, 112, 14)}"/>` +
  `<path fill="none" stroke-width="3.6" d="M66 112 a8 8 0 1 1 8 8 a5 5 0 1 1 -5 -5 M118 112 a8 8 0 1 1 8 8 a5 5 0 1 1 -5 -5"/>` +
  `<path fill="${MOUTH}" stroke-width="4" d="${oval(100, 164, 12, 16)}"/></g>` +
  // shut: >< eyes + zipped mouth
  `<g class="x x-shut"><path fill="none" stroke-width="5.5" d="M62 102 L82 112 L62 122 M138 102 L118 112 L138 122"/>` +
  `<path fill="none" stroke-width="4" d="M80 166 H120 M88 160 V172 M100 160 V172 M112 160 V172"/></g>` +
  // take: big shine + tear + D grin + the yellow ticket in hand
  `<g class="x x-take"><path fill="#fff" stroke="none" d="${ring(73, 103, 5)} ${ring(125, 103, 5)}"/>` +
  `<path fill="${SCREEN}" stroke-width="3" d="M86 124 Q92 136 86 140 Q80 136 86 124 Z"/>` +
  `<path fill="${MOUTH}" stroke-width="4" d="M78 156 H122 Q122 186 100 186 Q78 186 78 156 Z"/>` +
  `<rect class="x-ticket" fill="${LEMON}" stroke-width="4" x="136" y="146" width="46" height="32" rx="5" transform="rotate(10 159 162)"/></g>`;

// Day 7 boss (§5.3): 1.15x head (CSS), oiled side part, rimless glasses, shirt collar + striped tie and a lanyard
// badge; never clipped (head to the chin is visible).
function bossParts(g) {
  const shirt = g('#E9EDF3');
  return {
    below: `<path fill="${g(shade('#E9EDF3'))}" d="M22 252 Q26 206 68 188 L100 214 L132 188 Q174 206 178 252 Z"/>` +
      `<path fill="${shirt}" stroke="none" d="M34 252 Q38 214 70 198 L100 222 L130 198 Q162 214 166 252 Z"/>` +
      `<path fill="${g(SHUT_DEEP)}" d="M92 208 L108 208 L114 252 H86 Z"/>` +
      `<path fill="none" stroke="${g(LEMON)}" stroke-width="3" d="M89 226 L111 216 M87 242 L113 232"/>` +
      `<path fill="${shirt}" d="M68 188 L100 214 L84 230 Z M132 188 L100 214 L116 230 Z"/>` +
      `<path fill="none" stroke="${g(GUN)}" stroke-width="3" d="M62 196 Q70 222 66 252 M138 196 Q132 222 136 252"/>` +
      `<rect fill="${g(PAPER)}" stroke-width="3" x="126" y="226" width="26" height="22" rx="3"/>`,
    hair: `<path fill="${g(HAIR_C)}" d="M36 118 Q28 40 104 32 Q172 36 166 114 Q160 76 132 66 Q108 60 84 64 L78 56 Q54 72 46 118 Z"/>` +
      `<path fill="none" stroke="${g('#8A7068')}" stroke-width="4" d="M66 52 Q100 38 140 48 M84 64 L78 56"/>`,
    glasses: `<path fill="#DFF4FF" fill-opacity=".3" stroke="${g('#8A9BB0')}" stroke-width="2.4" d="M58 102 H94 V118 Q94 126 86 126 H66 Q58 126 58 118 Z M106 102 H142 V118 Q142 126 134 126 H114 Q106 126 106 118 Z"/>` +
      `<path fill="none" stroke="${g('#8A9BB0')}" stroke-width="2.4" d="M94 106 H106 M58 106 L40 102 M142 106 L160 102"/>`,
    brows: 'M60 86 L90 92 M110 92 L140 86',
  };
}

export function customerSVG(customer, visitIndex = 0, { fixed, gray = false } = {}) {
  const look = customerLook(customer, visitIndex, fixed);
  const boss = look.fixed === 'boss';
  const g = gray ? grayOf : (c) => c;
  const skinB = backlit(look.skin);
  const skin = g(skinB);
  const skinSh = g(shade(skinB));
  const hairC = g(backlit(look.hairC));
  const hatC = g(backlit(look.hatC));
  const bp = boss ? bossParts(g) : null;
  const hair = boss ? bp.hair : HAIR[look.hair](hairC);
  const acc = boss ? bp.glasses : look.acc.map((a) => ACC[a](hatC, g)).join('');
  const id = esc(customer && customer.id != null ? customer.id : '');
  const brows = boss ? bp.brows : BROWS[look.brows] || BROWS.flat;
  const vb = boss ? '0 0 200 250' : '0 0 200 200';
  return `<svg class="cust${gray ? ' gray' : ''}${boss ? ' boss' : ''}" viewBox="${vb}" overflow="visible" aria-hidden="true" data-id="${id}" data-look="${look.head}.${look.eyes}.${look.hair}${look.acc.map((a) => '+' + a).join('')}">` +
    `<g class="h-all" stroke="${INK}" stroke-width="${K_OUT}" stroke-linejoin="round" stroke-linecap="round">` +
    (boss ? bp.below : '') +
    `<path fill="${skin}" d="${oval(37, 124, 11, 13)} ${oval(163, 124, 11, 13)}"/>` +
    `<path fill="${skin}" d="${HEADS[look.head] || HEADS.round}"/>` +
    `<path fill="${skinSh}" stroke="none" d="M150 88 C166 122 160 170 118 192 C150 168 156 124 146 94 Z M88 144 a5 3.4 0 1 0 10 0 a5 3.4 0 1 0 -10 0 Z"/>` +
    `<path class="f-nose" fill="none" stroke-width="${K_IN}" d="M100 126 Q95 138 104 140"/>` +
    `<path class="f-mouth" fill="none" stroke-width="${K_IN + 0.6}" d="${boss ? 'M84 164 Q100 170 118 160' : 'M86 168 Q100 174 114 168'}"/>` +
    `<path class="brows" fill="none" stroke-width="${K_OUT}" d="${brows}"/>` +
    eyesUp(look.eyes) + hair +
    `<path class="f-rim" fill="none" stroke="${g(WARM_RIM)}" stroke-width="4.5" opacity=".9" d="M56 ${boss ? 58 : 60} Q100 ${boss ? 26 : 22} 146 ${boss ? 58 : 60}"/>` +
    acc + FACES +
    `</g></svg>`;
}

// ─── Order signs (§6) ──────────────────────────────────────────────────────────────────────────
const STAGE_RE = /[（(][^）)]*[）)]/g;
const stripStage = (s) => String(s ?? '').replace(STAGE_RE, '').replace(/\|/g, '').trim();
const ZH_PARTICLE = /(喔|啦|齁|欸|啊|吧|謝謝|～|~)+$/;
const ZH_PUNCT_TAIL = /[。！!？?…~～\s]+$/;
const ZH_HESITANT = /^(嗯|那個|等一下)/;
const EN_HESITANT = /^(u+m+|uh+|hmm+|hold on|wait|oh,? you go)/i;

const ZH_INTERJ = /^[欸啊喔齁蛤嘿]+[～~？?！!\s]+/;
const ZH_FILLER = /^([欸啊喔齁蛤嘿嗯～~\s]+|那個|等一下|請問)[？?！!…]*$/;
const ZH_LEAD_PUNCT = /^[，,。！!？?…～~\s]+/;

function zhClause(text) {
  // Clauses end at ，。！ or at a ？ that has more text after it (the ？ stays on its clause).
  const clauses = text.replace(/([？?])(?=.)/g, '$1\u0000').split(/[，,。！!\u0000]/);
  for (const raw of clauses) {
    let c = raw.trim();
    if (ZH_FILLER.test(c)) continue;
    const q = /[？?]\s*$/.test(c);
    let prev;
    do {
      prev = c;
      c = c.replace(ZH_PUNCT_TAIL, '').replace(ZH_PARTICLE, '');
    } while (c !== prev && c);
    c = c.replace(ZH_INTERJ, '').replace(ZH_LEAD_PUNCT, '');
    if (c) return q ? c + '？' : c;
  }
  return '……';
}

const ZH_NO_LINE_START = /^[，,。！!？?…～~、）)]/;
// Latin/digit runs stay whole and count as ~0.55 of a CJK cell.
const zhTokens = (s) => s.match(/[A-Za-z0-9][A-Za-z0-9\-.%']*|./gsu) || [];
const tokW = (t) => (/^[A-Za-z0-9]/.test(t) ? t.length * 0.55 : 1);

function zhWrap(s) {
  const toks = zhTokens(s);
  const w = toks.map(tokW);
  const total = w.reduce((x, y) => x + y, 0);
  if (total <= 7) return s;
  const cut = (limit) => { // index of first token past `limit` cells
    let acc = 0;
    for (let i = 0; i < toks.length; i++) { acc += w[i]; if (acc > limit + 1e-9) return i; }
    return toks.length;
  };
  if (total <= 14) {
    // balanced two lines (max 7 cells each); never start line 2 with punctuation
    let b = cut(Math.ceil(total / 2));
    const max1 = cut(7);
    while (b < max1 && ZH_NO_LINE_START.test(toks[b])) b++;
    while (b > 1 && ZH_NO_LINE_START.test(toks[b] || '')) b--;
    return toks.slice(0, b).join('') + '\n' + toks.slice(b).join('');
  }
  const b1 = cut(7);
  let acc = 0;
  let l2 = '';
  for (let i = b1; i < toks.length && acc + w[i] <= 5; i++) { acc += w[i]; l2 += toks[i]; }
  l2 = l2.replace(/[，,。！!？?…～~\s]+$/, '');
  return toks.slice(0, b1).join('') + '\n' + l2 + '……';
}

function enWrap(s, max = 18) {
  const words = s.split(/\s+/).filter(Boolean);
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = w;
    else if ((cur + ' ' + w).length <= max) lines[lines.length - 1] = cur + ' ' + w;
    else lines.push(w);
  }
  if (lines.length > 2) {
    let l2 = lines[1];
    while (l2.length > max - 1) l2 = l2.slice(0, -1);
    return lines[0] + '\n' + l2.replace(/[\s,.;:!?]+$/, '') + '…';
  }
  return lines.map((l) => (l.length > max ? l.slice(0, max - 1) + '…' : l)).join('\n');
}

/** Text shown on a customer's order sign (§6.3). */
export function signText(customer, lang = 'zh') {
  if (!customer) return '';
  if (customer.sign) return String(customer.sign);
  const en = lang === 'en';
  if (customer.cups != null) return en ? `${customer.cups} ${customer.cups === 1 ? 'cup' : 'cups'}` : `${customer.cups}杯`;
  const says = stripStage(customer.says);
  if (en) {
    if (customer.key !== 'shut' && EN_HESITANT.test(says)) return 'Ummm…';
    const first = (says.match(/^[^,.;!…—]*[?]?/) || [says])[0].trim() || says;
    return first ? enWrap(first) : '…';
  }
  if (customer.key !== 'shut' && ZH_HESITANT.test(says)) return '嗯……';
  return zhWrap(zhClause(says));
}

export function signKind(customer) {
  if (!customer) return 'gun';
  if (customer.cups === 249) return 'trap';
  return customer.key === 'shut' || customer.key === 'take' ? customer.key : 'gun';
}

const REQ_ZH = ['不要太冰', '正常冰', '去冰', '少冰', '微冰', '多冰', '無糖', '半糖', '微糖', '少糖', '少甜', '全糖', '去糖', '甜度', '冰塊', '常溫', '熱的', '溫的', '加珍珠', '去珍珠'];
const REQ_EN = /\b(no ice|less ice|light ice|extra ice|no sugar|half sugar|less sugar|sugar|ice|extra|swap|without|warm|hot)\b/i;

function circleFirst(line, lang, done) {
  if (done.v) return esc(line);
  let idx = -1;
  let len = 0;
  if (lang === 'en') {
    const m = REQ_EN.exec(line);
    if (m) { idx = m.index; len = m[0].length; }
  } else {
    for (const w of REQ_ZH) {
      const i = line.indexOf(w);
      if (i >= 0 && (idx < 0 || i < idx || (i === idx && w.length > len))) { idx = i; len = w.length; }
    }
  }
  if (idx < 0) return esc(line);
  done.v = true;
  return esc(line.slice(0, idx)) +
    `<span class="sign-circle">${esc(line.slice(idx, idx + len))}<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="50" cy="20" rx="47" ry="17"/></svg></span>` +
    esc(line.slice(idx + len));
}

const jade = (html) => html.replace(/翡翠檸檬/g, '<span class="jade">翡翠檸檬</span>');

// Text cells: CJK = 1, Latin/digits ≈ 0.55. Used to fit sign text (font size in cqw via --fs).
const cellsOf = (line) => [...line].reduce((a, c) => a + (/[\u2e80-\u9fff\uff00-\uffef]/.test(c) ? 1 : 0.55), 0);
const FIT = { gun: [31, 15, 9], take: [38, 19, 8], trap: [38, 19, 8], shut: [44, 99, 7.5] }; // [width, height, max]
function fitSize(kind, lines, hesitant) {
  const [w, h, max] = FIT[kind] || FIT.gun;
  const cells = Math.max(1, ...lines.map(cellsOf));
  const fs = Math.min(hesitant ? 10 : max, w / cells, h / (lines.length * 1.12));
  return Math.max(3.6, Math.round(fs * 10) / 10);
}

function signBody(kind, text, lang, scribble) {
  const lines = String(text).split('\n');
  const num = /^(\d{1,4})\s*(杯|cups?)$/i.exec(lines[0]);
  if (num && lines.length === 1 && kind !== 'shut') {
    return `<div class="sign-text is-num"><span class="sign-num">${num[1]}</span><span class="sign-unit">${esc(num[2])}</span></div>`;
  }
  if (kind === 'shut') {
    const done = { v: false };
    const body = lines.map((l) => `<span class="sign-line">${circleFirst(l, lang, done)}</span>`).join('');
    const scr = scribble
      ? `<span class="sign-scribble">${[...String(scribble)].map((c, i) => `<i style="--i:${i}">${esc(c)}</i>`).join('')}</span>`
      : '';
    return `<div class="sign-text" style="--fs:${fitSize(kind, lines)}cqw">${body}${scr}</div>`;
  }
  const hes = /^(嗯|Um)/.test(lines[0]) && lines.length === 1;
  return `<div class="sign-text${hes ? ' is-hesitant' : ''}" style="--fs:${fitSize(kind, lines, hes)}cqw">` +
    `${lines.map((l) => `<span class="sign-line">${jade(esc(l))}</span>`).join('')}</div>`;
}

/** Order sign markup (§6.1). Mount inside .cam at the sign anchor; see the contract above. */
export function signSVG(customer, lang = 'zh', { kind, text, scribble, mini = false, back = false } = {}) {
  const k = kind || signKind(customer);
  const t = text != null ? String(text) : signText(customer, lang);
  const badge = k === 'trap' ? 'gun' : k;
  const big = customer && customer.cups === 250 && k === 'take' && !mini;
  const deco =
    k === 'gun' ? '<i class="sign-tape t1"></i><i class="sign-tape t2"></i>'
      : k === 'take' || k === 'trap' ? '<i class="sign-hole"></i>' : '';
  const extra =
    k === 'shut' ? '<i class="sign-strike"></i>'
      : k === 'take' ? `<i class="sign-stamp">${lang === 'en' ? 'DEAL' : '收'}</i>`
        : k === 'trap' ? '<svg class="sign-crack" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M58 0 L50 18 L60 30 L46 46 L52 60"/></svg>' : '';
  const cls = `sign sign-${k}${mini ? ' mini' : ''}${big ? ' is-250' : ''}${back ? ' show-back' : ''}`;
  return `<div class="${cls}" data-kind="${k}" data-state="${mini ? 'up' : 'down'}" lang="${lang === 'en' ? 'en' : 'zh'}">` +
    (big ? '<div class="sign-burst"></div>' : '') +
    `<div class="sign-card"><div class="sign-face">${deco}${signBody(k, t, lang, scribble)}${extra}</div>` +
    `<div class="sign-back"></div><span class="sign-badge">${KEY_ICONS[badge]}</span></div></div>`;
}

export function miniSign(kind, text, lang = 'zh') {
  return signSVG(null, lang, { kind, text, mini: true });
}


// ─── Props ─────────────────────────────────────────────────────────────────────────────────────
export const FINGER_SVG = `<svg class="finger-svg" viewBox="0 0 60 80" overflow="visible" aria-hidden="true">
<g stroke="${INK}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">
<path fill="${GUN}" d="M34 62 L58 50 L66 74 L44 84 Z"/>
<path fill="${SKIN}" d="M8 6 Q3 10 6 15 L24 40 Q16 44 20 52 L34 66 Q46 74 56 60 Q62 50 56 40 L48 30 Q44 25 38 28 Q36 22 30 24 Q27 19 21 22 L13 8 Q11 4 8 6 Z"/>
<path fill="none" stroke-width="2.4" d="M30 24 L36 33 M38 28 L43 36 M21 22 L28 32"/>
</g>
</svg>`;

export const STAR_SVG = `<svg class="star-svg" viewBox="0 0 40 40" aria-hidden="true"><path fill="${LEMON}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" d="M20 2 L24 16 L38 20 L24 24 L20 38 L16 24 L2 20 L16 16 Z"/></svg>`;

// Roll-up iron shutter (opening beat A1): cool grey metal slats with a thin highlight on each, a bottom bar with
// a handle, a painted shop mark; .gate-glow is the warm light that spills under the rising edge.
export const DOOR_GATE_SVG = `<svg class="gate-svg" viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice" overflow="visible" aria-hidden="true">
<defs><linearGradient id="gateGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD98C" stop-opacity=".75"/><stop offset="1" stop-color="#FFD98C" stop-opacity="0"/></linearGradient></defs>
<rect x="-200" y="-700" width="760" height="1310" fill="#6E7682"/>
<path fill="none" stroke="#4E555F" stroke-width="3.2" d="${Array.from({ length: 82 }, (_, i) => `M-200 ${-690 + i * 16} H560`).join(' ')}"/>
<path fill="none" stroke="#A3ABB6" stroke-width="1.2" d="${Array.from({ length: 82 }, (_, i) => `M-200 ${-686 + i * 16} H560`).join(' ')}"/>
<text class="gate-tag" x="180" y="300" transform="rotate(-8 180 300)">來250杯</text>
<rect x="-200" y="606" width="760" height="22" fill="#3A3F47" stroke="${INK}" stroke-width="2"/>
<rect x="150" y="592" width="60" height="14" rx="5" fill="#2A2D33" stroke="${INK}" stroke-width="2.4"/>
<rect class="gate-glow" x="-200" y="628" width="760" height="120" fill="url(#gateGlow)"/>
</svg>`;

export function ticketHTML(lines = ['No.001', '250杯', '兩個月後取餐']) {
  const [a, b, c] = lines;
  return `<div class="ticket"><i class="ticket-hole"></i><b class="ticket-no">${esc(a ?? '')}</b>` +
    `<span class="ticket-cups">${esc(b ?? '')}</span><span class="ticket-when">${esc(c ?? '')}</span></div>`;
}

// ─── Shop background (§6.1) ────────────────────────────────────────────────────────────────────
// Vertical vanishing point VP = (180, -896) (-140% of 640): the wall slats lean in slightly toward it.
const VPY = -896;
const toVP = (xb, yb, y) => 180 + (xb - 180) * (y - VPY) / (yb - VPY);
const WALL_TOP = 24;
const WALL_BOT = 330;
const SLATS = Array.from({ length: 21 }, (_, i) => {
  const xb = -60 + i * 24;
  return `M${r1(toVP(xb, WALL_BOT, WALL_TOP))} ${WALL_TOP} L${xb} ${WALL_BOT}`;
}).join(' ');

// A takeaway cup standing on a shelf: bottom at (x, y), width w, height h. Body path, plus the lid/straw strokes
// and the clear top band returned separately so a shelf merges them into one node each.
function cup(x, y, w, h, fill, { dome = false } = {}) {
  const t = 0.12 * w;
  return {
    body: `<path fill="${fill}" d="M${x} ${y - h} H${x + w} L${r1(x + w - t)} ${y} H${r1(x + t)} Z"/>`,
    lid: dome
      ? `M${x - 1} ${y - h} H${x + w + 1} M${r1(x + 1)} ${y - h} Q${r1(x + w / 2)} ${r1(y - h - w * 0.55)} ${r1(x + w - 1)} ${y - h} M${r1(x + w * 0.62)} ${r1(y - h - w * 0.4)} L${r1(x + w * 0.8)} ${r1(y - h - w * 0.9)}`
      : `M${x - 1} ${y - h} H${x + w + 1} M${r1(x + w * 0.62)} ${y - h} L${r1(x + w * 0.85)} ${r1(y - h - w * 0.5)}`,
    clear: `M${x} ${y - h} H${x + w} L${r1(x + w - t * 0.3)} ${r1(y - h + h * 0.24)} H${r1(x + t * 0.3)} Z`,
  };
}
function shelf(x0, cups, extra) {
  const parts = cups.map(([dx, w, h, fill, o]) => cup(x0 + dx, 186, w, h, fill, o));
  const pearls = cups.map(([dx, w, , , o], i) => (o && o.pearls ? `${ring(x0 + dx + w * 0.36, 182, 1.9)} ${ring(x0 + dx + w * 0.64, 181, 1.9)}` : '')).join(' ');
  return parts.map((p) => p.body).join('') +
    `<path fill="${PAPER}" fill-opacity=".55" stroke="none" d="${parts.map((p) => p.clear).join(' ')}"/>` +
    `<path fill="none" stroke-width="1.9" d="${parts.map((p) => p.lid).join(' ')}"/>` +
    (pearls.trim() ? `<path fill="#2A1A12" stroke="none" d="${pearls}"/>` : '') + extra;
}

export const SHOP_SVG = `<svg class="shop-svg" viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice" overflow="visible" aria-hidden="true">
<defs>
<radialGradient id="wallGrad" gradientUnits="userSpaceOnUse" cx="180" cy="218" r="250"><stop class="wall-hi" offset="0" stop-color="#FBE6BE"/><stop class="wall-mid" offset=".55" stop-color="#EBC08A"/><stop offset="1" stop-color="#A9734A"/></radialGradient>
<radialGradient id="poolGrad"><stop class="pool-hi" offset="0" stop-color="#FFF4D6" stop-opacity=".7"/><stop offset="1" stop-color="#FFF4D6" stop-opacity="0"/></radialGradient>
<linearGradient id="lbGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFEFD2"/></linearGradient>
<linearGradient id="gsGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD_HI}"/><stop offset=".5" stop-color="#FFD23A"/><stop offset="1" stop-color="#F29A00"/></linearGradient>
</defs>
<rect x="-200" y="${WALL_TOP}" width="760" height="${WALL_BOT - WALL_TOP + 400}" fill="url(#wallGrad)"/>
<path fill="none" stroke="${SLAT}" stroke-width="1.1" opacity=".6" d="${SLATS}"/>
<ellipse cx="180" cy="200" rx="210" ry="160" fill="url(#poolGrad)"/>
<rect x="-200" y="-700" width="760" height="${700 + WALL_TOP}" fill="${WOOD_DK}"/>
<rect x="-200" y="${WALL_TOP - 4}" width="760" height="5" fill="${WOOD_DK_HI}"/>
<g class="lamps" stroke="${INK_BG}" stroke-width="1.6" stroke-linejoin="round">
<g class="lamp lamp-l"><path fill="none" d="M96 -120 V6"/><path fill="${COUNTER_HI}" d="M84 6 H108 L116 20 H76 Z"/><path fill="#FFF4D6" stroke="none" d="M84 20 a12 6 0 0 0 24 0 Z"/></g>
<g class="lamp lamp-r"><path fill="none" d="M264 -120 V6"/><path fill="${COUNTER_HI}" d="M252 6 H276 L284 20 H244 Z"/><path fill="#FFF4D6" stroke="none" d="M252 20 a12 6 0 0 0 24 0 Z"/></g>
</g>
<g class="lightbox" stroke-linejoin="round">
<rect x="14" y="30" width="332" height="55" rx="8" fill="${COUNTER}" stroke="${INK_BG}" stroke-width="1.6"/>
<rect x="19" y="35" width="322" height="45" rx="4" fill="url(#lbGrad)"/>
<path fill="none" stroke="#E6D3B3" stroke-width="1.2" d="M124 40 V75 M224 40 V75"/>
<path fill="${DRINK.jade}" stroke="${INK_BG}" stroke-width="1.4" d="M27 44 H45 L42 75 H30 Z"/>
<path fill="${DRINK.milk}" stroke="${INK_BG}" stroke-width="1.4" d="M130 44 H148 L145 75 H133 Z"/>
<path fill="#2A1A12" d="${ring(137, 70, 2.2)} ${ring(142, 69, 2.2)}"/>
<path fill="none" stroke="${INK_BG}" stroke-width="2" stroke-linecap="round" d="M25.5 44 H46.5 M38 44 L42 37 M128.5 44 H149.5 M141 44 L145 37"/>
<text class="lb-text lb-1" x="52" y="54"><tspan class="lb-name" x="52" y="54">翡翠檸檬</tspan><tspan class="lb-price" x="52" y="73">75</tspan></text>
<text class="lb-text lb-2" x="155" y="54"><tspan class="lb-name" x="155" y="54">珍珠奶茶</tspan><tspan class="lb-price" x="155" y="73">55</tspan></text>
<rect class="gs-halo" x="222" y="32" width="122" height="51" rx="8" fill="none" stroke="${LEMON}" stroke-width="7"/>
<rect class="gs-cell" x="228" y="38" width="110" height="39" rx="4" fill="${GUN}"/>
<rect class="gs-gold" x="228" y="38" width="110" height="39" rx="4" fill="url(#gsGold)"/>
<text class="lb-text goldsign" id="goldsign" x="283" y="55"><tspan class="gs-a" x="283" y="55">黃金比例</tspan><tspan class="gs-b" x="283" y="72">不能調</tspan></text>
</g>
<g class="caller">
<rect x="11" y="96" width="70" height="47" rx="7" fill="#1A1320" stroke="${INK_BG}" stroke-width="1.6"/>
<text class="caller-label" x="46" y="111">取餐號碼</text>
<text class="caller-num ghost" x="46" y="136">888</text>
<text id="callnum" class="caller-num" x="46" y="136">000</text>
</g>
<g class="shelves" transform="translate(0 10)" stroke="${INK_BG}" stroke-linejoin="round" stroke-linecap="round">
<path fill="${STEEL}" stroke-width="1.2" d="M-60 186 H96 V191 H-60 Z M264 186 H420 V191 H264 Z"/>
<path fill="${STEEL_LO}" stroke="none" d="M-60 191 H96 V194 H-60 Z M264 191 H420 V194 H264 Z"/>
${shelf(4, [[0, 16, 24, DRINK.milk, { pearls: true }], [21, 16, 24, DRINK.jade], [42, 16, 22, DRINK.lemon]],
    // cocktail shaker
    `<path fill="${STEEL}" stroke-width="1.4" d="M68 186 V170 Q68 166 72 166 H82 Q86 166 86 170 V186 Z M70 166 L72 158 H82 L84 166 Z"/><path fill="${STEEL_HI}" stroke="none" d="M71 169 h3 v15 h-3 Z"/>`)}
${shelf(270, [[0, 16, 24, DRINK.berry, { dome: true }], [21, 16, 25, DRINK.milk, { dome: true, pearls: true }], [42, 16, 23, DRINK.jade, { dome: true }]],
    // cup sealer
    `<path fill="${STEEL}" stroke-width="1.4" d="M332 186 V160 Q332 156 336 156 H360 V186 Z"/><path fill="${COUNTER}" stroke="none" d="M336 166 H360 V176 H336 Z"/><path fill="#FF3B30" stroke="none" d="${ring(340, 161, 1.6)}"/>`)}
</g>
</svg>`;

// ─── Counter (front layer; above the clerk) ────────────────────────────────────────────────────
// Steel top (y 307–326) with a white highlight and a dark band under it; dark purple acrylic front down past the
// frame with three seams; 現點現做 in backlit acrylic letters; the queue outside as cool night silhouettes.
const LIP_Y = 307;
const LIP_H = 19;

// One queue silhouette (head + shoulders, no face, no outline) at (x, y), scale s; the body runs on down past the
// frame. Cool rim light (0.5cqw) on the head and the near shoulder; phone users get a blue screen glow.
function silhouette(cls, x, y, s, fill, phone) {
  return `<g class="${cls}" transform="translate(${x} ${y}) scale(${s})">` +
    `<path fill="${fill}" d="M-46 300 V124 Q-46 54 0 48 Q46 54 46 124 V300 Z ${ring(0, 18, 24)} Z"/>` +
    `<path fill="none" stroke="${RIM}" stroke-width="${r1(1.8 / s)}" stroke-linecap="round" opacity=".6" d="M-18 0 Q0 -10 18 0 M-40 70 Q-31 54 -14 51"/>` +
    (phone ? `<path fill="${SCREEN}" d="M13 28 h10 v15 h-10 Z"/><path fill="${SCREEN}" opacity=".12" d="${ring(18, 35, 26)}"/>` : '') +
    '</g>';
}
const QUEUE_PEOPLE = [
  ['q-p1', 332, 494, 1.12, '#1A1D40', false],
  ['q-p2', 282, 520, 0.94, '#22264D', true],
  ['q-p3', 240, 548, 0.78, '#2B2F5A', false],
];
// Far crowd: heads and shoulders in the dark behind the three, one path per level (cumulative, data-crowd).
function crowdRow(cls, pts, fill) {
  const d = pts.map(([x, y, r]) => `${ring(x, y, r)} Z M${r1(x - r * 1.9)} 900 V${r1(y + r * 2.2)} Q${r1(x - r * 1.9)} ${r1(y + r * 1.2)} ${x} ${r1(y + r * 1.15)} Q${r1(x + r * 1.9)} ${r1(y + r * 1.2)} ${r1(x + r * 1.9)} ${r1(y + r * 2.2)} V900 Z`).join(' ');
  return `<path class="${cls}" fill="${fill}" d="${d}"/>`;
}
const QUEUE_SVG =
  `<g class="q-crowd">` +
  crowdRow('q-c3', [[214, 468, 7], [262, 456, 7], [350, 444, 8]], '#2A2C55') +
  crowdRow('q-c2', [[236, 478, 8], [300, 462, 8.5], [356, 470, 8]], '#262850') +
  crowdRow('q-c1', [[204, 496, 9], [268, 484, 9.5], [318, 476, 9]], '#22244A') +
  `</g><g class="q-in">` +
  [...QUEUE_PEOPLE].reverse().map((p) => silhouette(...p)).join('') +
  `</g>`;

/** One queue silhouette (0 = nearest) as a full-stage svg, for the gesture-mode bowling pins. */
export function queueSilhouetteSVG(i = 0) {
  const p = QUEUE_PEOPLE[Math.max(0, Math.min(2, i | 0))];
  return `<svg class="pin-svg" viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice" overflow="visible" aria-hidden="true">${silhouette('pin-' + i, p[1], p[2], p[3], p[4], p[5])}</svg>`;
}

// The clerk's resting hands on the steel top (shown by CSS for the arm poses that rest, see CLERK_SVG).
const hand = (cls, cx, flip) => {
  const s = flip ? -1 : 1;
  const X = (dx) => r1(cx + s * dx);
  return `<g class="ch ${cls}" stroke="${INK}" stroke-linejoin="round" stroke-linecap="round">` +
    `<path class="ch-skin" fill="${SKIN}" stroke-width="3.4" d="M${X(-22)} 313 Q${X(-24)} 300 ${X(-4)} 299 Q${X(18)} 298 ${X(22)} 309 Q${X(18)} 319 ${X(0)} 319 Q${X(-17)} 319 ${X(-22)} 313 Z"/>` +
    `<path fill="none" stroke-width="2" d="M${X(-8)} 310 V317 M${X(1)} 309 V317.5 M${X(10)} 310 V316.5"/>` +
    `<path fill="${SKIN_SH}" stroke="none" d="M${X(-18)} 315 Q${X(0)} 320 ${X(18)} 313 Q${X(10)} 318 ${X(0)} 318.5 Q${X(-12)} 318.5 ${X(-18)} 315 Z"/></g>`;
};

export const COUNTER_SVG = `<svg class="counter-svg" viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice" overflow="visible" aria-hidden="true">
<defs>
<linearGradient id="ctrSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${STEEL_HI}"/><stop offset=".55" stop-color="${STEEL}"/><stop offset="1" stop-color="${STEEL_LO}"/></linearGradient>
<linearGradient id="ctrFront" gradientUnits="userSpaceOnUse" x1="0" y1="${LIP_Y + LIP_H}" x2="0" y2="900"><stop offset="0" stop-color="${COUNTER_HI}"/><stop offset=".14" stop-color="${COUNTER}"/><stop offset="1" stop-color="${COUNTER_LO}"/></linearGradient>
</defs>
<rect x="-200" y="${LIP_Y + LIP_H}" width="760" height="900" fill="url(#ctrFront)"/>
<path fill="none" stroke="${COUNTER_HI}" stroke-width="1.2" opacity=".75" d="M90 ${LIP_Y + LIP_H + 8} V1300 M180 ${LIP_Y + LIP_H + 8} V1300 M270 ${LIP_Y + LIP_H + 8} V1300"/>
<rect x="-200" y="${LIP_Y + LIP_H}" width="760" height="8" fill="#0F0B1C" opacity=".55"/>
<rect x="-200" y="${LIP_Y}" width="760" height="${LIP_H}" fill="url(#ctrSteel)" stroke="${INK_BG}" stroke-width="1.6"/>
<path fill="none" stroke="#fff" stroke-width="2" opacity=".85" d="M-200 ${LIP_Y + 2.5} H560"/>
<g class="plaque"><rect x="232" y="410" width="110" height="28" rx="5" fill="#1C1630" stroke="${LEMON}" stroke-width="1.5"/>
<text class="plaque-text" x="287" y="430">現點現做</text></g>
${QUEUE_SVG}
<g class="q-cap"><text class="q-num" x="314" y="383"></text></g>
${hand('ch-l', 137, false)}${hand('ch-r', 223, true)}
</svg>`;

export function queueCrowd(queue) {
  const n = Number(queue) || 0;
  return n >= 60 ? 3 : n >= 15 ? 2 : n > 3 ? 1 : 0;
}

export function queueCapText(queue) {
  const n = Math.floor(Number(queue) || 0);
  return n > 3 ? '+' + (n - 3).toLocaleString('en-US') : '';
}

// ─── Door monitor: five night scenes (§6.1). Generic shapes only, cool palette. ─────────────────
// viewBox 86x64 = the monitor at 1:1 on a 360px stage. Layers L0 (far) .. L3 (near) drive the
// milestone parallax. Crowds are small cool-toned figures as grouped paths (≤ 40 per scene): every 3rd figure is
// 1.1x taller, every 4th checks a blue phone.
const MW = 86;
const MH = 64;
const CROWD_SHIRTS = ['#4E6488', '#6E86A8', '#38496A'];
const CROWD_SKINS = ['#8FA6C8', '#A9BCD8', '#7A90B2'];
function crowd(pts, h) {
  // Plain paths grouped by colour instead of one <use> per person: every <use> builds its own shadow tree, and
  // re-laying out up to 40 of them each time the queue changed cost long frames (A13).
  const bodies = new Map();
  const heads = new Map();
  const phones = [];
  const add = (m, k, d) => m.set(k, (m.get(k) || '') + d);
  pts.slice(0, 40).forEach(([x, y], i) => {
    const hh = i % 3 === 2 ? h * 1.1 : h;
    const w = hh / 2;
    const k = w / 20;
    const x0 = x - w / 2, y0 = y - hh;
    add(bodies, CROWD_SHIRTS[i % 3],
      `M${r1(x0)} ${r1(y)}Q${r1(x0)} ${r1(y0 + 18 * k)} ${r1(x)} ${r1(y0 + 17 * k)}Q${r1(x0 + w)} ${r1(y0 + 18 * k)} ${r1(x0 + w)} ${r1(y)}Z`);
    const r = 7 * k;
    add(heads, CROWD_SKINS[(i + 1) % 3], `M${r1(x - r)} ${r1(y0 + 8 * k)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0Z`);
    if (i % 4 === 3) phones.push(`M${r1(x + w * 0.3)} ${r1(y - hh * 0.86)} h${r1(w * 0.18)} v${r1(hh * 0.15)} h-${r1(w * 0.18)} Z`);
  });
  const paths = (m) => [...m].map(([c, d]) => `<path fill="${c}" d="${d}"/>`).join('');
  return `<g>${paths(bodies)}${paths(heads)}</g>` + (phones.length ? `<path fill="${SCREEN}" d="${phones.join(' ')}"/>` : '');
}
const along = (n, x0, y0, x1, y1) =>
  Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  });
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

const LABEL = {
  door: { zh: '門口', en: 'DOOR' },
  arcade: { zh: '騎樓', en: 'ARCADE' },
  metro: { zh: '捷運出口', en: 'METRO' },
  news: { zh: '新聞快報', en: 'NEWS' },
  aerial: { zh: '空拍', en: 'SKY CAM' },
};
function monLabel(id, lang) {
  const text = LABEL[id][lang === 'en' ? 'en' : 'zh'];
  const w = 20 + [...text].reduce((a, c) => a + (/[⺀-鿿]/.test(c) ? 14 : 8.6), 0);
  return `<g class="mon-tag"><rect x="1.5" y="1.5" width="${r1(w)}" height="17" rx="2" fill="${NIGHT_900}" fill-opacity=".72"/>` +
    `<circle class="mon-dot" cx="8" cy="10" r="3" fill="#FF3B30"/><text class="mon-label" x="14" y="15">${esc(text)}</text></g>`;
}

export const MONITOR_SCENES = [
  {
    id: 'door', min: 0, name: LABEL.door,
    svg: (q) => {
      const n = clampN(2 + q / 3, 2, 18);
      return `<g class="L0"><rect x="-20" y="-20" width="126" height="104" fill="#1B2438"/><path fill="#25304A" d="M-20 38 H106 V84 H-20 Z"/></g>` +
        `<g class="L1"><path fill="${GUN}" stroke="${NIGHT_900}" stroke-width="1" d="M-4 14 H44 L46 22 H-6 Z"/><path fill="${PAPER}" d="M4 14 H10 L11 22 H4 Z M18 14 H24 L25 22 H18 Z M32 14 H38 L39 22 H32 Z"/>` +
        `<rect x="6" y="22" width="30" height="24" fill="#5A4A3A" stroke="${NIGHT_900}" stroke-width="1"/><rect x="14" y="28" width="14" height="18" fill="#F4C77E"/></g>` +
        `<g class="L2">${crowd(along(n, 26, 50, 92, 58), 14)}</g>` +
        `<g class="L3"><path fill="none" stroke="#3A4A66" stroke-width="1.5" d="M-20 60 H106"/></g>`;
    },
  },
  {
    id: 'arcade', min: 50, name: LABEL.arcade,
    svg: (q) => {
      const n = clampN(12 + (q - 50) / 8, 12, 30);
      const cols = [8, 30, 52, 74].map((x) => `M${x} 14 V60 H${x + 6} V14 Z`).join(' ');
      const scooters = [6, 24, 42, 60, 78].map((x) => `M${x} 56 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M${x + 10} 56 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M${x + 2} 53 H${x + 14} L${x + 12} 49 H${x + 6} Z`).join(' ');
      return `<g class="L0"><rect x="-20" y="-20" width="126" height="104" fill="#22293A"/><path fill="#2E3850" d="M-20 4 H106 V14 H-20 Z"/><path fill="#F4C77E" opacity=".5" d="M2 20 h8 v6 h-8 Z M40 20 h8 v6 h-8 Z M64 20 h8 v6 h-8 Z"/></g>` +
        `<g class="L1">${crowd([...along(Math.ceil(n / 2), 2, 44, 84, 44), ...along(Math.floor(n / 2), 6, 49, 88, 49)], 11)}</g>` +
        `<g class="L2"><path fill="#4A5874" stroke="${NIGHT_900}" stroke-width="1" d="${cols}"/></g>` +
        `<g class="L3"><path fill="#56637E" stroke="${NIGHT_900}" stroke-width=".8" d="${scooters}"/></g>`;
    },
  },
  {
    id: 'metro', min: 200, name: LABEL.metro,
    svg: (q) => {
      const n = clampN(14 + (q - 200) / 30, 14, 34);
      return `<g class="L0"><rect x="-20" y="-20" width="126" height="104" fill="#161D2C"/><path fill="#212B3E" d="M-20 50 H106 V84 H-20 Z"/></g>` +
        `<g class="L1"><path fill="#6D7C96" stroke="${NIGHT_900}" stroke-width="1" d="M30 10 H84 V50 H30 Z"/><path fill="#161D2C" d="M36 22 H78 V50 H36 Z"/>` +
        `<rect x="40" y="12" width="22" height="8" rx="1.5" fill="${PAPER}" stroke="${NIGHT_900}" stroke-width=".8"/><rect x="64" y="12" width="8" height="8" rx="1.5" fill="${LEMON}" stroke="${NIGHT_900}" stroke-width=".8"/>` +
        `<path fill="none" stroke="${INK}" stroke-width="1.2" d="M43 16 H57 M53 13.5 L57 16 L53 18.5"/></g>` +
        `<g class="L2"><path fill="#3E4A62" d="M40 50 L76 24 H80 L44 50 Z"/>${crowd([...along(Math.ceil(n * 0.4), 44, 49, 76, 26), ...along(Math.floor(n * 0.6), 2, 58, 40, 52)], 10)}</g>` +
        `<g class="L3">${crowd([[10, 54]], 24)}<rect x="0" y="22" width="20" height="9" rx="1.5" fill="${LEMON}" stroke="${NIGHT_900}" stroke-width=".8"/><path fill="none" stroke="${INK}" stroke-width="1.2" d="M4 26.5 H16 M12 24 L16 26.5 L12 29"/></g>`;
    },
  },
  {
    id: 'news', min: 800, name: LABEL.news,
    svg: (q, lang) => {
      const n = clampN(22 + (q - 800) / 80, 22, 38);
      const loop = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        loop.push([43 + Math.cos(a) * 30, 46 + Math.sin(a) * 7]);
      }
      const ticker = lang === 'en' ? 'BREAKING  ENDLESS LINE AT TEA STAND  ' : '快訊  夜市驚見超長人龍  民眾：被罵很爽  ';
      return `<g class="L0"><rect x="-20" y="-20" width="126" height="104" fill="#1F2A44"/><path fill="#2D3B5C" d="M-4 40 V18 H8 V40 Z M66 40 V12 H76 V40 Z M78 40 V22 H90 V40 Z"/></g>` +
        `<g class="L1"><path fill="#5E7194" stroke="${NIGHT_900}" stroke-width="1" d="M36 44 V8 L43 2 L50 8 V44 Z"/><path fill="none" stroke="#3E4E6E" stroke-width="1" d="M36 16 H50 M36 24 H50 M36 32 H50"/></g>` +
        `<g class="L2">${crowd(loop, 7)}</g>` +
        `<g class="L3"><rect x="-2" y="48" width="90" height="17" fill="${GUN}"/><text class="mon-ticker" x="25" y="60.5">${esc(ticker)}</text>` +
        `<rect x="-2" y="48" width="24" height="17" fill="${NIGHT_900}"/><text class="mon-flash" x="10" y="60.5">LIVE</text></g>`;
    },
  },
  {
    id: 'aerial', min: 2500, name: LABEL.aerial,
    svg: () => {
      const blocks = [];
      for (let y = -2; y < 66; y += 17) for (let x = -2; x < 88; x += 21) blocks.push(`M${x} ${y} h16 v12 h-16 Z`);
      return `<g class="L0"><rect x="-20" y="-20" width="126" height="104" fill="#1E2638"/></g>` +
        `<g class="L1"><path fill="#33405A" stroke="#26304A" stroke-width=".8" d="${blocks.join(' ')}"/></g>` +
        `<g class="L2"><path class="snake" fill="none" stroke="${RIM}" stroke-width="2.6" stroke-dasharray="0.1 3" stroke-linecap="round" pathLength="600" d="M-4 15.5 H82 V32 H2 V49 H84 V66"/></g>` +
        `<g class="L3" fill="none" stroke="${PAPER}" stroke-width="1.2"><path d="M4 22 V18 H8 M78 18 H82 V22 M82 56 V60 H78 M8 60 H4 V56"/><path d="M43 34 V44 M38 39 H48"/></g>`;
    },
  },
];

export function monitorScene(queue) {
  const q = Number(queue) || 0;
  let i = 0;
  MONITOR_SCENES.forEach((s, k) => { if (q >= s.min) i = k; });
  return i;
}

export function monitorSVG(queue, lang = 'zh') {
  const s = MONITOR_SCENES[monitorScene(queue)];
  return `<svg class="mon-svg" data-scene="${s.id}" viewBox="0 0 ${MW} ${MH}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
    s.svg(Number(queue) || 0, lang) + monLabel(s.id, lang) + '</svg>';
}

export function monitorHTML(queue, lang = 'zh') {
  const s = MONITOR_SCENES[monitorScene(queue)];
  return `<div class="monitor" data-scene="${s.id}"><div class="mon-screen">${monitorSVG(queue, lang)}</div></div>`;
}

// ─── Shared art for packages B and C (§11) ─────────────────────────────────────────────────────
// Cup tower (§6.2): n finished cups in a two-row pyramid (3 = 2+1, 5 = 3+2, 7 = 4+3), bottom-aligned.
const STACK_FILLS = [DRINK.milk, DRINK.jade, DRINK.lemon, DRINK.berry];
export function cupStackCount(combo) {
  const c = Number(combo) || 0;
  return c >= 20 ? 7 : c >= 10 ? 5 : c >= 5 ? 3 : 0;
}
export function cupStackSVG(n = 0) {
  const k = Math.max(0, Math.min(9, Math.floor(Number(n) || 0)));
  const bottom = Math.ceil(k / 2);
  const W = Math.max(1, bottom) * 17 + 4;
  const H = 66;
  const cups = [];
  for (let i = 0; i < k; i++) {
    const row = i < bottom ? 0 : 1;
    const col = row ? i - bottom : i;
    const x = 2 + col * 17 + (row ? 8.5 : 0);
    const y = H - row * 25;
    cups.push({ x, y, fill: STACK_FILLS[i % STACK_FILLS.length], pearls: i % 4 === 0 });
  }
  const body = cups.map(({ x, y, fill }) => `<path fill="${fill}" d="M${x} ${y - 24} H${x + 15} L${x + 13} ${y} H${x + 2} Z"/>`).join('');
  const bands = cups.map(({ x, y }) => `M${x + 1} ${y - 15} H${x + 14} V${y - 10} H${x + 1.5} Z`).join(' ');
  const lids = cups.map(({ x, y }) => `M${x - 1} ${y - 24} H${x + 16} M${x + 10} ${y - 24} L${x + 13} ${y - 31}`).join(' ');
  const pearls = cups.filter((c) => c.pearls).map(({ x, y }) => `${ring(x + 5.5, y - 4, 1.8)} ${ring(x + 9.5, y - 4.5, 1.8)}`).join(' ');
  const top = cups.length ? cups[cups.length - 1] : { x: W / 2 - 7, y: H };
  return `<svg class="cup-stack-svg" data-n="${k}" viewBox="0 -14 ${W} ${H + 16}" overflow="visible" aria-hidden="true">` +
    (k ? `<g stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${body}` +
      `<path fill="${PAPER}" stroke="none" d="${bands}"/><path fill="none" stroke-width="2.4" d="${lids}"/>` +
      (pearls ? `<path fill="#2A1A12" stroke="none" d="${pearls}"/>` : '') + '</g>' : '') +
    `<g class="cs-steam" opacity="0" fill="none" stroke="${PAPER}" stroke-width="2.2" stroke-linecap="round">` +
    `<path d="M${r1(top.x + 4)} ${top.y - 30} q-4 -6 0 -12 q4 -6 0 -12"/><path d="M${r1(top.x + 11)} ${top.y - 32} q-4 -6 0 -12 q4 -6 0 -12"/></g></svg>`;
}

// Megaphone (mini event "大聲公"; voice-mode replay): bell to the right, five volume cells.
export const MEGAPHONE_SVG = `<svg class="prop-svg prop-megaphone" viewBox="0 0 150 90" overflow="visible" aria-hidden="true">
<g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
<path fill="${STEEL_LO}" d="M20 50 L28 76 H40 L36 50 Z"/>
<path fill="${PAPER}" d="M12 34 H34 V56 H12 Q6 56 6 50 V40 Q6 34 12 34 Z"/>
<path fill="${GUN}" d="M34 34 L84 10 V80 L34 56 Z"/>
<path fill="${GUN_DEEP}" stroke="none" d="M34 49 L84 66 V80 L34 56 Z"/>
<path fill="${PAPER}" d="M80 6 Q92 45 80 84 Q74 45 80 6 Z"/>
<path fill="none" stroke="${PAPER}" stroke-width="2.4" d="M44 30 L74 17"/>
</g>
<g class="mg-bars" stroke="${INK}" stroke-width="2">
<rect class="mg-bar" data-i="1" x="98" y="56" width="8" height="10" rx="2" fill="${NIGHT_500}"/>
<rect class="mg-bar" data-i="2" x="108" y="48" width="8" height="18" rx="2" fill="${NIGHT_500}"/>
<rect class="mg-bar" data-i="3" x="118" y="40" width="8" height="26" rx="2" fill="${NIGHT_500}"/>
<rect class="mg-bar" data-i="4" x="128" y="32" width="8" height="34" rx="2" fill="${NIGHT_500}"/>
<rect class="mg-bar" data-i="5" x="138" y="24" width="8" height="42" rx="2" fill="${NIGHT_500}"/>
</g></svg>`;

// Phone (mini event "前主管來電"): slides up from below, ringing.
export const PHONE_SVG = `<svg class="prop-svg prop-phone" viewBox="0 0 100 170" overflow="visible" aria-hidden="true">
<g class="ph-ring" fill="none" stroke="${RIM}" stroke-width="3" stroke-linecap="round"><path d="M-6 30 Q-14 46 -6 62 M-16 22 Q-28 46 -16 70"/><path d="M106 30 Q114 46 106 62 M116 22 Q128 46 116 70"/></g>
<g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
<rect x="4" y="2" width="92" height="166" rx="14" fill="${NIGHT_900}"/>
<rect x="10" y="14" width="80" height="140" rx="6" fill="${NIGHT_700}" stroke="none"/>
<circle cx="50" cy="56" r="17" fill="${UNIFORM_HI}" stroke="none"/>
<path fill="${STEEL}" stroke="none" d="M41 52 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 Z M34 70 Q36 62 50 62 Q64 62 66 70 Z"/>
<circle cx="30" cy="132" r="10" fill="${GUN}"/><circle cx="70" cy="132" r="10" fill="${MINT}"/>
<path fill="none" stroke="${PAPER}" stroke-width="2.6" d="M25 132 H35 M65 133 l4 4 l7 -9"/>
</g>
<text class="ph-name" x="50" y="100">前主管</text>
</svg>`;

// Calculator (mini event "計算機"): a real calculator with a DSEG7 display.
export const CALCULATOR_SVG = `<svg class="prop-svg prop-calculator" viewBox="0 0 110 150" overflow="visible" aria-hidden="true">
<g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
<rect x="3" y="3" width="104" height="144" rx="12" fill="${NIGHT_500}"/>
<rect x="12" y="14" width="86" height="34" rx="4" fill="#B9D3A0"/>
<path fill="${STEEL}" stroke-width="2" d="${[0, 1, 2, 3].flatMap((r) => [0, 1, 2].map((c) => `M${14 + c * 22} ${60 + r * 21} h18 v15 h-18 Z`)).join(' ')}"/>
<path fill="${TAKE}" stroke-width="2" d="M80 60 h18 v36 h-18 Z"/><path fill="${GUN}" stroke-width="2" d="M80 102 h18 v36 h-18 Z"/>
</g>
<text class="calc-num calc-ghost" x="94" y="41">888</text>
<text class="calc-num" x="94" y="41">0</text>
</svg>`;

// Order slips + rubber stamp (mini event "蓋章連打"): six slips, bottom to top; CSS shows data-i <= count.
export const SLIPS_SVG = `<svg class="prop-svg prop-slips" viewBox="0 0 130 120" overflow="visible" aria-hidden="true">
<g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round">
${[1, 2, 3, 4, 5, 6].map((i) => `<g class="slip" data-i="${i}" transform="translate(${i % 2 ? 2 : -2} ${-i * 5}) rotate(${(i % 3 - 1) * 2.5} 52 100)"><rect x="12" y="78" width="80" height="34" rx="2" fill="${PAPER}"/><path fill="none" stroke="${PAPER_SH}" stroke-width="2" d="M20 90 H70 M20 99 H58"/></g>`).join('')}
<g class="slip-stamp"><path fill="${TAKE}" d="M96 10 Q96 2 106 2 Q116 2 116 10 Q116 18 112 20 V30 H100 V20 Q96 18 96 10 Z"/><path fill="${GUN}" d="M90 30 H122 V42 H90 Z"/><path fill="${GUN_DEEP}" stroke="none" d="M92 38 H120 V41 H92 Z"/></g>
</g></svg>`;

export const EVENT_PROP_SVG = { megaphone: MEGAPHONE_SVG, phone: PHONE_SVG, calculator: CALCULATOR_SVG, stamp: SLIPS_SVG };

// Particle sprites (§8.2): ice cubes (滾), pearls (閉嘴), red stamp ink (收), a crumpled paper ball (the sign), gold cups (250).
const pt = (name, vb, body) => `<svg class="pt-svg pt-${name}" viewBox="${vb}" overflow="visible" aria-hidden="true">${body}</svg>`;
export const PARTICLE_SVG = {
  ice: pt('ice', '0 0 20 20', `<rect x="2" y="2" width="16" height="16" rx="4" fill="#DFF4FF" stroke="#7FB6D6" stroke-width="1.6"/><path fill="#fff" d="M5 5 h5 v3 h-5 Z"/>`),
  pearl: pt('pearl', '0 0 20 20', `<circle cx="10" cy="10" r="8" fill="#3A2418" stroke="${INK}" stroke-width="1.4"/><circle cx="7" cy="7" r="2.2" fill="#fff" fill-opacity=".85"/>`),
  ink: pt('ink', '0 0 24 24', `<path fill="${GUN}" d="M12 2 Q18 1 20 6 Q24 9 21 14 Q22 20 16 21 Q12 24 8 21 Q2 21 3 15 Q0 10 4 7 Q6 2 12 2 Z"/><path fill="${GUN_DEEP}" d="M15 15 a3 2 0 1 0 6 0 a3 2 0 1 0 -6 0 Z"/>`),
  paper: pt('paper', '0 0 24 24', `<path fill="${PAPER}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" d="M4 9 L9 3 L16 4 L21 9 L20 17 L14 21 L6 19 L3 14 Z"/><path fill="none" stroke="${PAPER_SH}" stroke-width="1.4" d="M8 8 L12 12 L17 10 M7 15 L12 12 L14 18"/>`),
  cup: pt('cup', '0 0 20 26', `<path fill="#FFD23A" stroke="#A85F00" stroke-width="1.6" stroke-linejoin="round" d="M3 6 H17 L15 25 H5 Z"/><path fill="none" stroke="#A85F00" stroke-width="1.8" stroke-linecap="round" d="M2 6 H18 M12 6 L15 0"/><path fill="${GOLD_HI}" d="M5 9 h3 v12 h-2 Z"/>`),
};

// Logo (§7.2): a backlit acrylic sign — ink base, paper face, red inner frame, tilted −4°, warm halo behind.
// The letters are the glyph outlines of jf open 粉圓 (Huninn, 來 杯) and Baloo 2 ExtraBold (250 ! CUPS), both
// SIL OFL 1.1, so the logo never waits for a web font. "250": gold gradient, ink outline, 7 px of amber depth and
// a white glint; "！" sticks out past the right edge like a sticker.
const LOGO_GLYPHS = {
  "來": { adv: 100, d: 'M49.5 6.5Q45.4 6.5 45.4 2V-25.3Q41.2 -20.4 35.4 -15.6Q29.6 -10.8 23.3 -6.9Q17 -3 11.1 -0.8Q9.2 -0.1 7.8 -1Q6.3 -1.8 6.1 -3.7Q5.8 -5.3 6.5 -6.5Q7.1 -7.6 9.1 -8.5Q13.1 -10.2 18 -13.2Q22.9 -16.1 28 -19.7Q33.1 -23.3 37.7 -27.2Q42.2 -31.1 45.4 -34.8V-63.4H12.5Q7.8 -63.4 7.8 -67.2Q7.8 -70.9 12.5 -70.9H45.4V-77.9Q45.4 -82.4 49.5 -82.4Q53.6 -82.4 53.6 -77.9V-70.9H86.6Q91.2 -70.9 91.2 -67.2Q91.2 -63.4 86.6 -63.4H53.6V-34.4Q60.4 -27.3 69.9 -20.7Q79.3 -14.1 91.4 -9.2Q94.9 -7.8 94 -4Q93.7 -2.4 92.5 -1.6Q91.3 -0.7 90 -0.8Q87.9 -1.1 84 -2.9Q80.1 -4.6 73.6 -8.9Q68.5 -12.3 63.2 -16.6Q58 -20.8 53.6 -25.7V2Q53.6 6.5 49.5 6.5ZM87.8 -31.4Q86.2 -31.2 85.1 -32Q84 -32.8 82.6 -34.2Q80.3 -36.5 78 -38.8Q75.7 -41.1 73.2 -43.3Q71.6 -40.8 69.5 -38.1Q67.3 -35.3 64.8 -33.3Q63.2 -32 61.8 -32Q60.4 -32 59.3 -33Q58 -34.1 58.2 -35.7Q58.5 -37.2 60 -38.7Q63.8 -42.8 66.5 -47.3Q69.1 -51.8 71.3 -57.4Q71.9 -58.8 73 -59.6Q74 -60.4 75.6 -60.2Q77 -60.1 77.9 -59.2Q78.8 -58.3 78.9 -57.2Q79 -55.9 78.5 -54Q78 -52.1 76.4 -48.9Q81.1 -45.8 84.4 -43Q87.7 -40.2 89.6 -38.5Q90.7 -37.5 91 -36.4Q91.3 -35.3 91.1 -34.5Q90.6 -31.8 87.8 -31.4ZM8.6 -30Q7.3 -31.2 7.8 -32.8Q8.2 -34.4 9.7 -36Q13.5 -40.7 16.6 -45.7Q19.6 -50.6 21.9 -56.6Q23.1 -59.8 26.4 -59.7Q27.8 -59.6 28.8 -58.7Q29.7 -57.8 29.8 -56.6Q29.9 -55.3 29.4 -53.6Q28.9 -51.8 27.4 -48.7Q35.8 -42.8 39.2 -39.5Q40.3 -38.5 40.6 -37.5Q40.9 -36.4 40.7 -35.6Q40.2 -33 37.5 -32.6Q35.9 -32.4 34.9 -33.1Q33.8 -33.9 32.4 -35.2L24.5 -43.1Q22.2 -39.1 19.8 -35.9Q17.4 -32.7 14.7 -30.4Q13.1 -29 11.4 -29Q9.7 -28.9 8.6 -30Z' },
  "杯": { adv: 100, d: 'M24.3 6.7Q20.5 6.7 20.5 2.7V-38.4Q19.4 -34.7 18 -31Q16.6 -27.3 14.8 -23.6Q11.3 -16.3 8.9 -16.3Q5.4 -16.3 5.4 -20.4Q5.4 -21.8 6.7 -24Q16.5 -39 19.8 -55H10.2Q5.9 -55 5.9 -58.9Q5.9 -62.6 10.3 -62.6H20.5V-78.4Q20.5 -82.5 24.3 -82.5Q28.1 -82.5 28.1 -78.4V-62.6H37.1Q40.9 -62.6 40.9 -58.9Q40.9 -55 37.1 -55H28.1V-43.9Q29.1 -44.9 30.3 -44.9Q31.9 -44.9 34.3 -41.9L36.8 -38.4Q40.9 -33.1 40.9 -31.8Q40.9 -28.5 37.3 -28.5Q35.7 -28.5 30.6 -36.6L29 -38.7L28.1 -40.2V2.7Q28.1 6.7 24.3 6.7ZM64.4 6.5Q60.5 6.5 60.5 1.7V-41.9Q58.5 -38.8 56 -35.1Q53.4 -31.3 51.1 -28Q48.7 -24.7 47.1 -22.7Q40 -13.9 37.8 -13.9Q34 -13.9 34 -18.1Q34 -20 36.7 -22.7Q38.1 -24.1 39.8 -25.9Q41.4 -27.6 43.1 -29.8Q50.5 -39 55.9 -48.8Q61.2 -58.5 64.6 -68.8H43.6Q38.8 -68.8 38.8 -72.6Q38.8 -76.4 43.6 -76.4H89.2Q93.9 -76.4 93.9 -72.6Q93.9 -68.8 89.2 -68.8H72.9L68.3 -57.6V1.7Q68.3 6.5 64.4 6.5ZM90.1 -13.7Q89 -13.7 87.6 -15.4Q86.2 -17 84.3 -20Q78.7 -28.9 72.5 -37.4Q70.8 -39.6 70.8 -40.9Q70.8 -44.3 74.4 -44.3Q76.5 -44.3 82.2 -36.9L88.9 -27.6Q91.5 -23.9 93 -21.5Q94.4 -19 94.4 -18.1Q94.4 -13.7 90.1 -13.7Z' },
  "b_2": { adv: 52.2, d: 'M6 -52Q6 -55.5 8.2 -57.8Q10.5 -60 14.6 -61.2Q18.6 -62.3 24.1 -62.3Q32 -62.3 37.3 -59.9Q42.6 -57.4 45.3 -53.2Q48 -49 48 -43.7Q48 -38.4 45 -33.5Q42.1 -28.5 36.1 -23.7L23 -13.2H47Q47.6 -12.2 48.2 -10.5Q48.7 -8.7 48.7 -6.7Q48.7 -3.1 47.1 -1.6Q45.5 0 42.9 0H8.2Q6 -1.5 4.8 -3.9Q3.5 -6.3 3.5 -9.4Q3.5 -12.8 5 -15.2Q6.4 -17.5 8 -18.9L21.8 -30.7Q27 -35.1 28.9 -37.8Q30.8 -40.5 30.8 -42.7Q30.8 -45.5 28.6 -47.1Q26.3 -48.7 22.3 -48.7Q18.3 -48.7 15.2 -47.5Q12 -46.2 9.9 -44.8Q8.3 -46 7.2 -47.8Q6 -49.6 6 -52Z' },
  "b_5": { adv: 52.2, d: 'M24.4 -60.8 21.9 -50.8 20.9 -37.7Q22.8 -38.2 24.8 -38.6Q26.7 -39 29.7 -39Q36.7 -39 41.2 -36.4Q45.6 -33.7 47.8 -29.2Q50 -24.7 50 -19.2Q50 -13.7 47.4 -9Q44.8 -4.2 39.3 -1.3Q33.8 1.6 25 1.6Q18.9 1.6 14.3 0.4Q9.7 -0.9 7.1 -3.4Q4.5 -5.8 4.5 -9.4Q4.5 -12.2 6.2 -14.2Q7.8 -16.1 9.7 -17.1Q12.5 -15 15.7 -13.4Q18.9 -11.9 23.8 -11.9Q28.5 -11.9 30.7 -14Q32.8 -16.1 32.8 -19.1Q32.8 -22 30.9 -23.9Q29 -25.8 24.7 -25.8Q22 -25.8 20.2 -25.2Q18.4 -24.6 16.1 -23.5Q11.2 -23.7 8.4 -26.2Q5.5 -28.7 5.5 -33.7Q5.5 -34.4 5.5 -35Q5.5 -35.7 5.6 -37L6.8 -51.5Q7.1 -55.8 9.5 -58.3Q11.9 -60.8 16.2 -60.8ZM17.4 -47.1V-60.8H45Q45.7 -59.7 46.2 -58Q46.8 -56.3 46.8 -54.2Q46.8 -50.5 45.2 -48.8Q43.6 -47.1 40.8 -47.1Z' },
  "b_0": { adv: 60.6, d: 'M40 -30.4Q40 -36.3 38.9 -40.4Q37.7 -44.5 35.5 -46.7Q33.3 -48.8 30.2 -48.8Q27.1 -48.8 25 -46.7Q22.8 -44.5 21.7 -40.4Q20.6 -36.3 20.6 -30.4Q20.6 -21 23.1 -16.4Q25.6 -11.9 30.2 -11.9Q34.9 -11.9 37.5 -16.4Q40 -21 40 -30.4ZM30.3 1.6Q22.4 1.6 16.4 -2Q10.3 -5.6 6.9 -12.7Q3.5 -19.8 3.5 -30.4Q3.5 -40.7 6.9 -47.8Q10.3 -54.9 16.4 -58.6Q22.4 -62.3 30.3 -62.3Q38.1 -62.3 44.2 -58.6Q50.2 -54.9 53.7 -47.8Q57.1 -40.7 57.1 -30.4Q57.1 -19.8 53.7 -12.7Q50.2 -5.6 44.2 -2Q38.1 1.6 30.3 1.6Z' },
  "b_!": { adv: 29.8, d: 'M23.7 -55.8Q23.7 -53.5 23.6 -49.5Q23.4 -45.6 23.2 -40.9Q22.9 -36.1 22.4 -31.5Q21.9 -26.8 21.2 -23.1Q20.4 -22.4 18.4 -22Q16.3 -21.6 14.9 -21.6Q12.1 -21.6 10.1 -22.6Q8.1 -23.5 7.6 -26Q7.2 -28.3 6.8 -32.6Q6.4 -36.9 6.1 -42.1Q5.8 -47.3 5.7 -52.3Q5.5 -57.3 5.5 -61.1Q9.8 -63.5 15.1 -63.5Q19.2 -63.5 21.5 -61.6Q23.7 -59.7 23.7 -55.8ZM5.3 -7.6Q5.3 -11.7 7.9 -14.4Q10.5 -17 14.9 -17Q19.3 -17 21.9 -14.4Q24.5 -11.7 24.5 -7.6Q24.5 -3.5 21.9 -0.8Q19.3 1.8 14.9 1.8Q10.5 1.8 7.9 -0.8Q5.3 -3.5 5.3 -7.6Z' },
  "b_C": { adv: 57.1, d: 'M54.1 -51.8Q54.1 -49.3 52.8 -47.4Q51.5 -45.4 49.8 -44.3Q47.3 -46 44.3 -47.2Q41.3 -48.4 37.4 -48.4Q32.3 -48.4 28.8 -46.2Q25.2 -44.1 23.4 -40Q21.5 -36 21.5 -30.3Q21.5 -21.5 26 -16.9Q30.4 -12.3 38.3 -12.3Q42.4 -12.3 45.2 -13.4Q48.1 -14.5 50.7 -15.9Q52.4 -14.6 53.4 -12.6Q54.3 -10.6 54.3 -8Q54.3 -5.7 53.1 -3.8Q51.9 -1.9 49 -0.6Q47.2 0.2 43.9 1Q40.6 1.8 35.9 1.8Q26.9 1.8 19.6 -1.6Q12.2 -5 7.9 -12.1Q3.5 -19.2 3.5 -30.3Q3.5 -40.7 7.7 -47.9Q11.9 -55 19.1 -58.8Q26.2 -62.5 34.8 -62.5Q40.9 -62.5 45.2 -61.1Q49.5 -59.7 51.8 -57.3Q54.1 -54.9 54.1 -51.8Z' },
  "b_U": { adv: 66.4, d: 'M33.2 1.8Q24.8 1.8 18.8 -1.2Q12.7 -4.2 9.5 -9.6Q6.2 -15 6.2 -22.2V-28.3H23.7V-22.5Q23.7 -17.8 26.4 -15.1Q29 -12.3 33.2 -12.3Q37.4 -12.3 40 -15.1Q42.7 -17.8 42.7 -22.5V-28.3H60.2V-22.2Q60.2 -15 57 -9.6Q53.7 -4.2 47.7 -1.2Q41.6 1.8 33.2 1.8ZM23.7 -25.6H6.2V-60.8Q7.4 -61 9.8 -61.4Q12.1 -61.7 14.3 -61.7Q19.3 -61.7 21.5 -60Q23.7 -58.3 23.7 -53.4ZM60.2 -25.4H42.7V-60.8Q43.9 -61 46.2 -61.4Q48.6 -61.7 50.8 -61.7Q55.8 -61.7 58 -60Q60.2 -58.3 60.2 -53.4Z' },
  "b_P": { adv: 58.1, d: 'M23.9 -32.5H28.7Q32.8 -32.5 35.4 -34.5Q37.9 -36.6 37.9 -40.4Q37.9 -44.2 35.5 -46.2Q33.2 -48.3 28.7 -48.3Q27.1 -48.3 26.1 -48.2Q25 -48.2 23.9 -48ZM29.8 -18.8H6.5V-54.9Q6.5 -57 7.7 -58.2Q8.9 -59.3 10.8 -60Q14.2 -61.2 18.9 -61.8Q23.6 -62.3 27.3 -62.3Q41 -62.3 48.4 -56.4Q55.7 -50.5 55.7 -40.4Q55.7 -33.9 52.5 -29.1Q49.3 -24.2 43.5 -21.5Q37.7 -18.8 29.8 -18.8ZM6.5 -26.4H24V-0.1Q22.9 0.2 20.6 0.5Q18.3 0.8 15.9 0.8Q10.7 0.8 8.6 -1.1Q6.5 -2.9 6.5 -7.5Z' },
  "b_S": { adv: 55.1, d: 'M25.1 -12.4Q30 -12.4 32 -14Q34 -15.6 34 -17.6Q34 -19.6 32.4 -20.8Q30.8 -21.9 27.9 -22.9L23.7 -24.3Q17.9 -26.3 13.5 -28.6Q9 -30.8 6.5 -34.4Q4 -38 4 -43.8Q4 -52.3 10.6 -57.4Q17.1 -62.5 28.9 -62.5Q34.7 -62.5 39.2 -61.4Q43.7 -60.3 46.3 -58.1Q48.9 -55.8 48.9 -52.3Q48.9 -49.8 47.7 -47.9Q46.5 -46 44.8 -44.7Q42.6 -46.1 38.9 -47.2Q35.2 -48.2 30.8 -48.2Q26.3 -48.2 24.2 -47Q22.1 -45.7 22.1 -43.8Q22.1 -42.3 23.5 -41.4Q24.8 -40.4 27.3 -39.6L32.6 -37.9Q42.1 -34.9 47.1 -30.1Q52.1 -25.4 52.1 -17.4Q52.1 -8.9 45.4 -3.6Q38.6 1.8 25.7 1.8Q19.6 1.8 14.7 0.5Q9.8 -0.8 6.9 -3.4Q4 -6 4 -9.7Q4 -12.6 5.7 -14.7Q7.4 -16.7 9.4 -17.8Q12.2 -15.6 16.2 -14Q20.3 -12.4 25.1 -12.4Z' },
};
function glyphRun(chars, x, base, size, prefix = '') {
  let cx = x;
  const out = [];
  for (const ch of chars) {
    const g = LOGO_GLYPHS[prefix + ch];
    if (!g) continue;
    out.push(`<path transform="translate(${r1(cx)} ${base}) scale(${size / 100})" d="${g.d}"/>`);
    cx += (g.adv * size) / 100;
  }
  return { svg: out.join(''), end: cx };
}
export function logoSVG(lang = 'zh') {
  const en = lang === 'en';
  const id = en ? 'en' : 'zh'; // ids per language: both logos may share a page (art-demo)
  const num = glyphRun('250', en ? 30 : 86, 134, en ? 104 : 112, 'b_');
  const word = en
    ? glyphRun('CUPS', num.end + 6, 126, 50, 'b_')
    : glyphRun('杯', num.end + 5, 128, 54, '');
  const bang = glyphRun('!', word.end + 1, 136, 92, 'b_');
  const g = `#lg250-${id}`;
  return `<svg class="logo-svg" viewBox="0 0 360 200" overflow="visible" aria-hidden="true">` +
    `<defs><radialGradient id="lgHalo-${id}"><stop offset="0" stop-color="#FFD98C" stop-opacity=".55"/><stop offset="1" stop-color="#FFD98C" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="lgGold-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD_HI}"/><stop offset=".5" stop-color="#FFD23A"/><stop offset="1" stop-color="#F29A00"/></linearGradient>` +
    `<g id="lg250-${id}">${num.svg}</g><clipPath id="lgClip-${id}"><use href="${g}"/></clipPath></defs>` +
    `<ellipse class="lg-halo" cx="180" cy="100" rx="200" ry="120" fill="url(#lgHalo-${id})"/>` +
    `<g class="lg-sign" transform="rotate(-4 180 100)">` +
    `<rect x="6" y="20" width="340" height="164" rx="24" fill="${INK}"/>` +
    `<rect x="13" y="26" width="326" height="148" rx="18" fill="${PAPER}"/>` +
    `<path fill="${PAPER_SH}" d="M13 146 H339 V156 Q339 174 321 174 H31 Q13 174 13 156 Z"/>` +
    `<rect x="21" y="34" width="310" height="132" rx="13" fill="none" stroke="${GUN}" stroke-width="3.5"/>` +
    `<g fill="${INK}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round">${en ? '' : glyphRun('來', 24, 128, 56, '').svg}${word.svg}</g>` +
    `<g class="lg-250">` +
    `<use href="${g}" x="7" y="7" fill="${INK}" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>` +
    `<use href="${g}" fill="${INK}" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>` +
    [6, 5, 4, 3, 2, 1].map((i) => `<use href="${g}" x="${i}" y="${i}" fill="#A85F00"/>`).join('') +
    `<use href="${g}" fill="url(#lgGold-${id})"/>` +
    `<g clip-path="url(#lgClip-${id})"><path class="lg-shine" fill="#fff" fill-opacity=".75" d="M0 72 Q180 48 360 64 V80 Q180 64 0 88 Z"/></g>` +
    `</g>` +
    `<g fill="${GUN}" stroke="${INK}" stroke-width="5" stroke-linejoin="round" paint-order="stroke" transform="rotate(8 ${r1(bang.end - 14)} 100)">${bang.svg}</g>` +
    `</g></svg>`;
}
export const LOGO_SVG = logoSVG('zh');
