// layout.js — gameplay v3 landscape stage geometry (docs/gameplay-v3-shop.md 10.1, 10.9): a 1280×720 design stage, the
// camera behind the counter looking out and tilted down onto the work table (docs/art-direction-v2.md 13). The top 37%
// (y < LIP_Y) is the street in perspective; below the counter lip the table recedes: a back bench (the tall machines),
// the middle worktop (pot, toppings, lemon board, waffle iron) and the front prep mat, plus side areas (a drinks fridge
// on the left, the pickup shelf and the part-timer on the right). Pure numbers (design px), no DOM: ui.js places
// everything with them (1 design px = 100/1280 cqw), tests check them. Every station is at least 61 design px on its
// short side (≈ 40 CSS px at 844×390).
//
// The work table has a FIXED place for every piece of equipment the shop can ever own (Shawarma Legend shows its empty
// equipment slots): what is not bought / not on today's menu yet is drawn as a covered spot with a lock (lockedSpots), so
// the table looks full from day 1 and nothing moves when an upgrade or a new station arrives.
//
//   STAGE = { w: 1280, h: 720 }, LIP_Y (counter lip top), TABLE_Y (work table top), BACK_Y / MID_Y / FRONT_Y (where the
//   back, middle and front rows stand), HUD (the top-left HUD block), BUBBLE (the order-bubble band)
//   streetPoint(u, lane = 0) → { x, y, s }   feet point and scale of a person at world position u (engine.js: 0 = the
//                                           shop door, 1 = the far corner); lane > 0 = further out toward the road
//   lineU(u) → u'                            where a person waiting in line is drawn (the line is spread out near the door
//                                           so people stand apart instead of in a clump; continuous, monotonic, = u ≥ 1)
//   seatPoint(i, n) → { x, y, s }           a customer at counter spot i of n (chest up over the counter lip)
//   seatColumn(i, n) → { x, w }            the counter spot's column (gesture area, bubble)
//   stepPoint(i, n, p) → { x, y, s }       stepping up from the door to spot i (p 0..1, eased)
//   PERSON = { w, h }                       a person's box at scale 1 (walker art viewBox 200×480)
//   stations(spec) → { name: { x, y, w, h } }   spec = { teas, toppings, ice, sugar, workSlots, shelf, sealers, helper,
//                                           milk, foam, shake, lemon, snack, bag }; names: rack, tea-<k>, milk, foam, sugar,
//                                           ice, shaker, sealer-<k>, shelf (+ shelf-<i>), pot, top-<k>, lemon, board, waffle,
//                                           snack, trash, bag, slot-<w>, helper, tower
//   lockedSpots(spec) → [{ name, kind, x, y, w, h }]   the covered spots of everything not owned yet
//   DECOR → { name: { x, y, w, h } }        fixed table dressing (fridge, light box, fan, register, cash tray, tip jar, the
//                                           prep mat, the golden card spot)
//   bubbleWidth(n, colW, extra) → design px the order bubble's width for an n-cup order (extra = the snack card)
//   ROW_SCALE                               the depth scale of the back / middle / front rows (art and tests)
//   CORNER_U: people further than this are behind the corner building (not drawn); PILLAR: the right window pillar
export const STAGE = { w: 1280, h: 720 };
export const LIP_Y = 268;
export const TABLE_Y = 284;
export const BACK_Y = 430;          // the back bench: rack, tea tanks, milk, foam, syrup, ice, shaker, sealers, light box
export const MID_Y = 548;           // the middle worktop: pearl pot, topping trays, lemon tray + board, waffle iron, snack bags
export const FRONT_Y = 704;         // the front: trash, carry bag, the prep mat with the cup holders, register, tower, part-timer
export const ROW_SCALE = { back: 0.86, mid: 0.93, front: 1 };
export const PERSON = { w: 150, h: 360 };
export const CORNER_U = 1.0;
/** The HUD block (top left, over the street's far end): pause, day, money + goal, clock; stars under the money. */
export const HUD = { x: 10, y: 8, w: 470, h: 86 };
/** Order bubbles live in this band above the customers' heads (tail tip at the bottom). */
export const BUBBLE = { top: 4, bottom: 128 };

const V = { x: -300, y: 122 };      // vanishing point (off the left edge, on the horizon)
const DOOR = { x: 440, y: 280 };    // the head of the line, right in front of the counter's left end
const DOOR_S = 0.56;
const DEPTH = 1.0;                  // scale = DOOR_S / (1 + DEPTH × u): the far corner (u 1) is 0.28
export const SEAT_S = 0.76;         // at the counter (chest up, big and close; the big-head look, art direction 14); the far corner is ≈ 37% of this
const SEAT_ZONE = [496, 1192];
/** The shop window's right pillar: the shop props hang on it (air conditioner, speaker, megaphone, ticket machine). */
export const PILLAR = { x: 1196, y: 34, w: 84, h: 234 };
const SEAT_HEAD_TOP = 116;          // the top of a seated customer's box (the head starts ≈ 9 px lower; the lip cuts them at the chest)
const LINE_SPREAD = 1.8;            // lineU: how much the line is stretched at the door

export function streetPoint(u, lane = 0) {
  const z = 1 + DEPTH * Math.max(-0.2, u);
  const s = DOOR_S / z;
  const x = V.x + (DOOR.x - V.x) / z;
  const y = V.y + (DOOR.y - V.y) / z - lane * 50 * (s / DOOR_S);
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

/** Order bubble width (design px): one card per cup (+ a narrow snack card), scaled down to stay near its column. */
export function bubbleWidth(n, colW, extra = 0) {
  const k = Math.max(1, n | 0);
  const natural = (k === 1 ? 84 : k === 4 ? 98 : 14 + k * 64) + (extra ? (k === 4 ? 30 : 40) : 0);
  return Math.min(natural, Math.max(104, colW * (k >= 3 || extra ? 1.16 : 1.02)));
}

// ---- the work table: every spot is fixed ----
const TEA_ORDER = ['black', 'green', 'jade'];
export const TOP_ORDER = ['pearl', 'pudding', 'taro', 'grass', 'bean', 'coconut'];
const stand = (x, feet, w, aspect) => ({ x, y: feet - w * aspect, w, h: w * aspect });
const SHELF = { x: 1036, y: 298, w: 240, h: 250, cols: 3 };
const SLOTS = 5;
const SEALERS = 2;
const SHELF_MAX = 6;

function allSpots() {
  const r = {};
  // back row (feet at BACK_Y): cup rack | tea tanks ×3 | milk pump | cheese foam | syrup | ice | shaker | sealers ×2
  r.rack = stand(70, BACK_Y, 76, 1.25);
  TEA_ORDER.forEach((k, i) => { r['tea-' + k] = stand(152 + i * 74, BACK_Y, 68, 1.55); });
  r.milk = stand(374, BACK_Y, 62, 1.6);
  r.foam = stand(442, BACK_Y, 72, 1.35);
  r.sugar = stand(520, BACK_Y, 62, 1.55);
  r.ice = stand(588, BACK_Y, 86, 0.95);
  r.shaker = stand(680, BACK_Y, 84, 1.2);
  for (let k = 0; k < SEALERS; k++) r['sealer-' + k] = stand(770 + k * 82, BACK_Y, 78, 150 / 110);
  // the pickup shelf: two tiers on the right, behind the middle row
  r.shelf = { ...SHELF };
  const cw = SHELF.w / SHELF.cols;
  for (let i = 0; i < SHELF_MAX; i++) {
    const row = i < SHELF.cols ? 0 : 1;
    const col = row ? i - SHELF.cols : i;
    r['shelf-' + i] = { x: SHELF.x + col * cw, y: SHELF.y + row * 126, w: cw, h: 122 };
  }
  // middle row (feet at MID_Y): pearl pot | topping trays ×6 | lemon tray | cutting board | waffle-ball iron | snack bags
  r.pot = stand(66, MID_Y, 106, 0.95);
  TOP_ORDER.forEach((k, i) => { r['top-' + k] = stand(178 + i * 76, MID_Y, 72, 0.95); });
  r.lemon = stand(638, MID_Y, 64, 0.95);
  r.board = stand(706, MID_Y, 92, 0.8);
  r.waffle = stand(804, MID_Y, 98, 0.9);
  r.snack = stand(906, MID_Y, 64, 1.1);
  // front row (feet at FRONT_Y): trash | carry bag | the prep mat with 5 cup holders | cup tower | part-timer
  r.trash = stand(10, FRONT_Y, 70, 1.35);
  r.bag = stand(86, FRONT_Y, 100, 1.05);
  for (let w = 0; w < SLOTS; w++) r['slot-' + w] = { x: 196 + w * 104, y: 586, w: 98, h: FRONT_Y - 586 };
  r.tower = { x: 930, y: 554, w: 130, h: 150 };
  r.helper = { x: 1132, y: 552, w: 142, h: 166 };
  return r;
}
const ALL = allSpots();

/** Fixed table dressing (pure decoration, no input, no words). */
export const DECOR = {
  fridge: { x: 0, y: 290, w: 62, h: 300 },
  lightbox: { x: 936, y: 326, w: 94, h: 104 },
  golden: { x: 958, y: 382, w: 52, h: 46 },
  fan: { x: 974, y: 476, w: 58, h: 72 },
  register: { x: 722, y: 598, w: 132, h: 106 },
  cashTray: { x: 856, y: 652, w: 70, h: 52 },
  tipJar: { x: 1064, y: 624, w: 62, h: 80 },
  mat: { x: 188, y: 618, w: 530, h: 90 },
};

function owned({ teas = ['black'], toppings = ['pearl'], ice = false, sugar = false, workSlots = 3, shelf = 4, sealers = 1, helper = false,
  milk = false, foam = false, shake = false, lemon = false, snack = false, bag = false } = {}) {
  const has = new Set(['rack', 'pot', 'tower', 'trash', 'shelf']);
  teas.forEach((k) => has.add('tea-' + k));
  toppings.forEach((k) => has.add('top-' + k));
  if (ice) has.add('ice');
  if (sugar) has.add('sugar');
  if (milk) has.add('milk');
  if (foam) has.add('foam');
  if (shake) has.add('shaker');
  if (lemon) { has.add('lemon'); has.add('board'); }
  if (snack) { has.add('waffle'); has.add('snack'); }
  if (bag) has.add('bag');
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
