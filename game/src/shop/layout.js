// layout.js — gameplay v3 landscape stage geometry (docs/gameplay-v3-shop.md 10.1): a 1280×720 design stage, the
// camera behind the counter looking out. Top 45% (y < LIP_Y) is the street in perspective, the bottom 55% the work table.
// Pure numbers (design px), no DOM: ui.js places everything with them (1 design px = 100/1280 cqw), tests check them.
//
//   STAGE = { w: 1280, h: 720 }, LIP_Y (counter lip top), TABLE_Y (work table top)
//   streetPoint(u, lane = 0) → { x, y, s }   feet point and scale of a person at world position u (engine.js: 0 = the
//                                           shop door, 1 = the far corner); lane > 0 = further out toward the road
//   seatPoint(i, n) → { x, y, s }           a customer at counter spot i of n (feet hidden behind the counter)
//   seatColumn(i, n) → { x, w }            the counter spot's column (gesture area, bubble)
//   stepPoint(i, n, p) → { x, y, s }       stepping up from the door to spot i (p 0..1, eased)
//   PERSON = { w, h }                       a person's box at scale 1 (walker art viewBox 200×480)
//   stations({ teas, toppings, ice, sugar, workSlots, shelf, sealers }) → { name: { x, y, w } } (heights follow the art)
//   CORNER_U: people further than this are behind the corner building (not drawn); PILLAR: the right window pillar
export const STAGE = { w: 1280, h: 720 };
export const LIP_Y = 324;
export const TABLE_Y = 342;
export const PERSON = { w: 150, h: 360 };
export const CORNER_U = 1.0;

const V = { x: -300, y: 150 };      // vanishing point (off the left edge, on the horizon)
const DOOR = { x: 440, y: 335 };    // the head of the line, right in front of the counter's left end
const DOOR_S = 0.62;
const DEPTH = 1.1;                  // scale = DOOR_S / (1 + DEPTH × u): the far corner (u 1) is ≈ 0.3
export const SEAT_S = 0.78;         // at the counter; the far corner is ≈ 38% of this
const SEAT_ZONE = [496, 1192];
/** The shop window's right pillar: the shop props hang on it (air conditioner, speaker, megaphone, ticket machine). */
export const PILLAR = { x: 1196, y: 40, w: 84, h: 284 };
const SEAT_HEAD_TOP = 168;          // where a seated customer's head starts

export function streetPoint(u, lane = 0) {
  const z = 1 + DEPTH * Math.max(-0.2, u);
  const s = DOOR_S / z;
  const x = V.x + (DOOR.x - V.x) / z;
  const y = V.y + (DOOR.y - V.y) / z - lane * 60 * (s / DOOR_S);
  return { x, y, s: s * (1 - 0.1 * lane) };
}

export function seatColumn(i, n) {
  const w = (SEAT_ZONE[1] - SEAT_ZONE[0]) / n;
  return { x: SEAT_ZONE[0] + i * w, w };
}
export function seatPoint(i, n) {
  const c = seatColumn(i, n);
  return { x: c.x + c.w / 2, y: SEAT_HEAD_TOP + PERSON.h * SEAT_S, s: SEAT_S };
}
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2);
export function stepPoint(i, n, p) {
  const a = streetPoint(0);
  const b = seatPoint(i, n);
  const e = ease(Math.max(0, Math.min(1, p)));
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - Math.sin(Math.PI * e) * 14, s: a.s + (b.s - a.s) * e };
}

// ---- the work table ----
const spreadIn = (x0, x1, n, w, gap) => {
  const total = n * w + (n - 1) * gap;
  const start = x0 + (x1 - x0 - total) / 2;
  return Array.from({ length: n }, (_, i) => start + i * (w + gap));
};

export function stations({ teas = ['black'], toppings = ['pearl'], ice = false, sugar = false, workSlots = 3, shelf = 4, sealers = 1 } = {}) {
  const r = {};
  // back row: cup rack | tea tanks | work slots | sealer(s) | shelf
  r.rack = { x: 12, y: 372, w: 100 };
  spreadIn(120, 384, teas.length, 84, 6).forEach((x, i) => { r['tea-' + teas[i]] = { x, y: 352, w: 84 }; });
  const sw = Math.min(140, (482 - (workSlots - 1) * 8) / workSlots);
  spreadIn(392, 874, workSlots, sw, 8).forEach((x, i) => { r['slot-' + i] = { x, y: 358, w: sw, h: 178 }; });
  if (sealers > 1) { r['sealer-0'] = { x: 880, y: 388, w: 76 }; r['sealer-1'] = { x: 958, y: 388, w: 76 }; }
  else r['sealer-0'] = { x: 890, y: 362, w: 124 };
  // shelf: two tiers, cols × 2
  const cols = Math.ceil(shelf / 2);
  r.shelf = { x: 1042, y: 348, w: 232, h: 196, cols };
  const cw = 232 / cols;
  for (let i = 0; i < shelf; i++) {
    const row = i < cols ? 0 : 1;
    const col = row ? i - cols : i;
    const offset = row && shelf % 2 ? cw / 2 : 0;
    r['shelf-' + i] = { x: 1042 + col * cw + offset, y: 348 + row * 98, w: cw, h: 96 };
  }
  // front row: pearl pot | topping trays | ice | syrup | cup tower | trash | helper
  r.pot = { x: 12, y: 572, w: 126 };
  spreadIn(150, 600, toppings.length, 108, 6).forEach((x, i) => { r['top-' + toppings[i]] = { x, y: 604, w: 108 }; });
  if (ice) r.ice = { x: 612, y: 604, w: 112 };
  if (sugar) r.sugar = { x: 736, y: 582, w: 66 };
  r.tower = { x: 812, y: 560, w: 176, h: 150 };
  r.trash = { x: 1000, y: 588, w: 92 };
  r.helper = { x: 1118, y: 572, w: 146, h: 148 };
  return r;
}
