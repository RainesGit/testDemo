// layout.js — gameplay v3 landscape stage geometry (docs/gameplay-v3-shop.md 10.1): a 1280×720 design stage, the
// camera behind the counter looking out. Top 45% (y < LIP_Y) is the street in perspective, the bottom 55% the work table.
// Pure numbers (design px), no DOM: ui.js places everything with them (1 design px = 100/1280 cqw), tests check them.
//
// The work table has a FIXED place for every piece of equipment the shop can ever own (Shawarma Legend shows its empty
// equipment slots): what is not bought / not on today's menu yet is drawn as a covered spot with a lock (lockedSpots), so
// the table looks full from day 1 and nothing moves when an upgrade arrives.
//
//   STAGE = { w: 1280, h: 720 }, LIP_Y (counter lip top), TABLE_Y (work table top), BACK_Y / FRONT_Y (the back bench and
//   the front worktop: where the stations stand), HUD (the top-left HUD block), BUBBLE (the order-bubble band)
//   streetPoint(u, lane = 0) → { x, y, s }   feet point and scale of a person at world position u (engine.js: 0 = the
//                                           shop door, 1 = the far corner); lane > 0 = further out toward the road
//   lineU(u) → u'                            where a person waiting in line is drawn (the line is spread out near the door
//                                           so people stand apart instead of in a clump; continuous, monotonic, = u ≥ 1)
//   seatPoint(i, n) → { x, y, s }           a customer at counter spot i of n (chest up over the counter lip)
//   seatColumn(i, n) → { x, w }            the counter spot's column (gesture area, bubble)
//   stepPoint(i, n, p) → { x, y, s }       stepping up from the door to spot i (p 0..1, eased)
//   PERSON = { w, h }                       a person's box at scale 1 (walker art viewBox 200×480)
//   stations({ teas, toppings, ice, sugar, workSlots, shelf, sealers, helper }) → { name: { x, y, w, h } }
//   lockedSpots(same) → [{ name, kind, x, y, w, h }]   the covered spots of everything not owned yet
//   DECOR → { name: { x, y, w, h } }        fixed props on the table (cash register, napkins, plant, the golden card spot)
//   bubbleWidth(n, colW) → design px        the order bubble's width for an n-cup order in a column colW wide
//   CORNER_U: people further than this are behind the corner building (not drawn); PILLAR: the right window pillar
export const STAGE = { w: 1280, h: 720 };
export const LIP_Y = 324;
export const TABLE_Y = 342;
export const BACK_Y = 540;          // the back bench surface: rack, tea tanks, ice, syrup, cup tower, sealers, shelf
export const FRONT_Y = 702;         // the front worktop: pearl pot, topping trays, the prep mat, trash, part-timer
export const PERSON = { w: 150, h: 360 };
export const CORNER_U = 1.0;
/** The HUD block (top left, over the street's far end): pause, day, money + goal, clock; stars under the money. */
export const HUD = { x: 10, y: 8, w: 470, h: 86 };
/** Order bubbles live in this band above the customers' heads (tail tip at the bottom). */
export const BUBBLE = { top: 20, bottom: 156 };

const V = { x: -300, y: 150 };      // vanishing point (off the left edge, on the horizon)
const DOOR = { x: 440, y: 335 };    // the head of the line, right in front of the counter's left end
const DOOR_S = 0.62;
const DEPTH = 1.1;                  // scale = DOOR_S / (1 + DEPTH × u): the far corner (u 1) is ≈ 0.3
export const SEAT_S = 0.92;         // at the counter (chest up, big and close); the far corner is ≈ 32% of this
const SEAT_ZONE = [496, 1192];
/** The shop window's right pillar: the shop props hang on it (air conditioner, speaker, megaphone, ticket machine). */
export const PILLAR = { x: 1196, y: 40, w: 84, h: 284 };
const SEAT_HEAD_TOP = 146;          // where a seated customer's head starts (the lip cuts them at the upper chest)
const LINE_SPREAD = 1.8;            // lineU: how much the line is stretched at the door

export function streetPoint(u, lane = 0) {
  const z = 1 + DEPTH * Math.max(-0.2, u);
  const s = DOOR_S / z;
  const x = V.x + (DOOR.x - V.x) / z;
  const y = V.y + (DOOR.y - V.y) / z - lane * 60 * (s / DOOR_S);
  return { x, y, s: s * (1 - 0.1 * lane) };
}

export function lineU(u) {
  if (!(u > 0) || u >= 1) return u;
  return u + LINE_SPREAD * u * (1 - u) * (1 - u);
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

/** Order bubble width (design px): one card per cup, scaled down to stay near its column. */
export function bubbleWidth(n, colW) {
  const k = Math.max(1, n | 0);
  const natural = k === 1 ? 88 : k === 4 ? 100 : 14 + k * 68;
  return Math.min(natural, Math.max(104, colW * (k >= 3 ? 1.14 : 1.02)));
}

// ---- the work table: every spot is fixed ----
const TEA_ORDER = ['black', 'green', 'jade'];
const TOP_ORDER = ['pearl', 'pudding', 'grass', 'coconut'];
const onBack = (x, w, aspect) => ({ x, y: BACK_Y - w * aspect, w, h: w * aspect });
const onFront = (x, w, aspect) => ({ x, y: FRONT_Y - w * aspect, w, h: w * aspect });
const SHELF = { x: 1032, y: 344, w: 242, h: 196, cols: 3 };
const SLOTS = 5;
const SEALERS = 2;
const SHELF_MAX = 6;

function allSpots() {
  const r = {};
  // back row: cup rack | tea tanks ×3 | ice | syrup | cup tower | (cash register) | sealers ×2 | shelf 3×2
  r.rack = onBack(8, 96, 1.1);
  TEA_ORDER.forEach((k, i) => { r['tea-' + k] = onBack(112 + i * 88, 84, 1.4); });
  r.ice = onBack(384, 100, 0.9);
  r.sugar = onBack(494, 58, 130 / 70);
  r.tower = { x: 560, y: 384, w: 150, h: 156 };
  for (let k = 0; k < SEALERS; k++) r['sealer-' + k] = onBack(852 + k * 90, 84, 150 / 110);
  r.shelf = { ...SHELF };
  const cw = SHELF.w / SHELF.cols;
  for (let i = 0; i < SHELF_MAX; i++) {
    const row = i < SHELF.cols ? 0 : 1;
    const col = row ? i - SHELF.cols : i;
    r['shelf-' + i] = { x: SHELF.x + col * cw, y: SHELF.y + row * 98, w: cw, h: 96 };
  }
  // front row: pearl pot | topping trays ×4 | the prep mat with 5 cup holders | trash | the part-timer
  r.pot = onFront(8, 122, 1);
  TOP_ORDER.forEach((k, i) => { r['top-' + k] = onFront(138 + i * 96, 92, 0.9); });
  for (let w = 0; w < SLOTS; w++) r['slot-' + w] = { x: 528 + w * 104, y: 560, w: 98, h: FRONT_Y - 560 };
  r.trash = onFront(1052, 74, 110 / 80);
  r.helper = { x: 1132, y: 548, w: 142, h: 166 };
  return r;
}
const ALL = allSpots();

/** Fixed table props (pure decoration, no input). */
export const DECOR = {
  register: { x: 722, y: 452, w: 120, h: 88 },
  golden: { x: 716, y: 470, w: 62, h: 54 },
  mat: { x: 520, y: 600, w: 530, h: 104 },
};

function owned({ teas = ['black'], toppings = ['pearl'], ice = false, sugar = false, workSlots = 3, shelf = 4, sealers = 1, helper = false } = {}) {
  const has = new Set(['rack', 'pot', 'tower', 'trash', 'shelf']);
  teas.forEach((k) => has.add('tea-' + k));
  toppings.forEach((k) => has.add('top-' + k));
  if (ice) has.add('ice');
  if (sugar) has.add('sugar');
  for (let w = 0; w < Math.min(SLOTS, workSlots); w++) has.add('slot-' + w);
  for (let k = 0; k < Math.min(SEALERS, sealers); k++) has.add('sealer-' + k);
  for (let i = 0; i < Math.min(SHELF_MAX, shelf); i++) has.add('shelf-' + i);
  if (helper) has.add('helper');
  return has;
}

export function stations(cfg = {}) {
  const has = owned(cfg);
  const r = {};
  for (const [k, v] of Object.entries(ALL)) if (has.has(k)) r[k] = { ...v };
  r.shelf.cols = SHELF.cols;
  return r;
}

const KIND = (name) => name.replace(/-.*$/, '');
export function lockedSpots(cfg = {}) {
  const has = owned(cfg);
  return Object.entries(ALL).filter(([k]) => !has.has(k)).map(([name, v]) => ({ name, kind: KIND(name), ...v }));
}
