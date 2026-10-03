// days.js — chapter 1 (days 1–7) tuning and customer pools. Pure data + helpers, no DOM.
// Spec: docs/first-minute-spec.md 4.2 (pace table), 4.3 (day 1 pool), 7 (one new system per day).
//
//   DAYS                      array of 7 day objects (DAYS[0] = day 1)
//   dayInfo(n)                the day object for day n (clamped to 1..7)
//   configForDay(n, extra?)   createGame() config for day n (extra is merged over it)
//   poolForDay(n, customers)  the customers that may appear on day n (engine order is decided by the engine)
//   clampDay(n)               1..7 integer
//
// Day object fields:
//   day, durationMs, windowStartMs, windowEndMs (W from t0), introBonusMs (first 10 s), landMs, landBigMs,
//   landWrongMs (landing pauses), enterMs (head pop), custRate (customer voice playbackRate), punchGapMs (silence
//   before the punch half of a clerk line), timeoutCostsAura, furyEnabled, furyPerCustomer, furyCorrect,
//   showAura / showFury (true | false | 'intro' = hidden until the day's intro shows it), pool { cats, ids, exclude },
//   fixedFirst (first customers by id), weights (by answer key), star1 (★1 queue threshold; null = boss day),
//   intro (id of the day's new-system intro: 'opening' | 'aura' | 'rage' | 'charge' | null),
//   talkLeadMs (the answer window t0 opens this long before the customer's voice ends; day 1 only, for pace),
//   original (null | { atMs }: the two-step original-film customer, once per round from atMs on)

export const DAY_COUNT = 7;

// Customer categories (the `cat` field of content.zh.js; the engine always runs on zh customers).
const CAT = {
  hesitate: '犹豫磨叽',
  sweet: '甜度冰块',
  topping: '加料改料',
  cheap: '贪小便宜',
  count: '数量',
  rush: '催单取餐',
  pay: '付款发票',
  influencer: '拍照网红',
  work: '职场社会',
  weird: '奇葩要求',
};

// 4.3: day 1 pool (gun 45% / take 30% / shut 25%), fixed opening trio 41 → 46 → 12.
const DAY1_IDS = [1, 6, 7, 8, 41, 42, 43, 44, 45, 5, 15, 46, 47, 49, 50, 11, 12, 13, 14, 16, 18];
const TRAP_249 = 48;

const BASE = {
  timeoutCostsAura: true,
  furyEnabled: true,
  furyPerCustomer: 6,
  furyCorrect: 4,
  showAura: true,
  showFury: true,
  fixedFirst: null,
  weights: null,
  intro: null,
  original: null,
  talkLeadMs: 0,
};

// 4.2 table: W / bonus / L / L+ / wrong / enter / rate / punch gap.
export const DAYS = [
  {
    ...BASE, day: 1, durationMs: 45000, windowStartMs: 2400, windowEndMs: 2400, introBonusMs: 300,
    landMs: 650, landBigMs: 1100, landWrongMs: 550, enterMs: 300, custRate: 1.0, punchGapMs: 200,
    timeoutCostsAura: false, furyEnabled: false, furyPerCustomer: 0, furyCorrect: 0, showAura: false, showFury: false,
    pool: { ids: DAY1_IDS }, fixedFirst: [41, 46, 12], weights: { gun: 0.45, take: 0.30, shut: 0.25 },
    star1: 30, intro: 'opening', talkLeadMs: 400,
  },
  {
    ...BASE, day: 2, durationMs: 90000, windowStartMs: 2100, windowEndMs: 2100, introBonusMs: 300,
    landMs: 550, landBigMs: 950, landWrongMs: 450, enterMs: 260, custRate: 1.0, punchGapMs: 200,
    furyEnabled: false, furyPerCustomer: 0, furyCorrect: 0, showAura: 'intro', showFury: false,
    pool: { ids: DAY1_IDS, cats: [CAT.hesitate, CAT.count, CAT.sweet] }, star1: 35, intro: 'aura',
  },
  {
    ...BASE, day: 3, durationMs: 90000, windowStartMs: 1850, windowEndMs: 1850, introBonusMs: 200,
    landMs: 450, landBigMs: 850, landWrongMs: 380, enterMs: 230, custRate: 1.04, punchGapMs: 180,
    furyPerCustomer: 12, furyCorrect: 8, // ×2 so the first rage comes at about 25 s
    pool: { ids: DAY1_IDS, cats: [CAT.hesitate, CAT.count, CAT.sweet, CAT.topping] }, star1: 40, intro: 'rage',
    original: { atMs: 30000 }, // after the first rage (about 15–20 s): one new thing at a time
  },
  {
    ...BASE, day: 4, durationMs: 90000, windowStartMs: 1650, windowEndMs: 1650, introBonusMs: 200,
    landMs: 380, landBigMs: 750, landWrongMs: 320, enterMs: 200, custRate: 1.06, punchGapMs: 160,
    pool: { ids: DAY1_IDS, cats: [CAT.hesitate, CAT.count, CAT.sweet, CAT.topping, CAT.cheap] }, star1: 45, intro: 'charge',
    original: { atMs: 40000 },
  },
  {
    ...BASE, day: 5, durationMs: 90000, windowStartMs: 1450, windowEndMs: 1450, introBonusMs: 200,
    landMs: 320, landBigMs: 650, landWrongMs: 280, enterMs: 180, custRate: 1.08, punchGapMs: 140,
    pool: { ids: DAY1_IDS, cats: [CAT.hesitate, CAT.count, CAT.sweet, CAT.topping, CAT.cheap, CAT.rush, CAT.pay] },
    star1: 50, original: { atMs: 40000 },
  },
  {
    ...BASE, day: 6, durationMs: 90000, windowStartMs: 1400, windowEndMs: 1400, introBonusMs: 200,
    landMs: 320, landBigMs: 650, landWrongMs: 280, enterMs: 180, custRate: 1.08, punchGapMs: 140,
    pool: { cats: Object.values(CAT), allow249: true }, star1: 55, original: { atMs: 40000 },
  },
  {
    ...BASE, day: 7, durationMs: 90000, windowStartMs: 1400, windowEndMs: 1400, introBonusMs: 200,
    landMs: 320, landBigMs: 650, landWrongMs: 280, enterMs: 180, custRate: 1.08, punchGapMs: 140,
    pool: { cats: Object.values(CAT), allow249: true }, star1: null, original: { atMs: 40000 },
  },
];

export function clampDay(n) {
  const d = Math.floor(Number(n) || 1);
  return Math.max(1, Math.min(DAY_COUNT, d));
}

export function dayInfo(n) {
  return DAYS[clampDay(n) - 1];
}

/** createGame() config for day n. signUp = arrive + enterMs + 280 (head pop, 120 ms, 160 ms sign flip). */
export function configForDay(n, extra = {}) {
  const d = dayInfo(n);
  const signUpMs = d.enterMs + 280;
  return {
    durationMs: d.durationMs,
    windowStartMs: d.windowStartMs,
    windowEndMs: d.windowEndMs,
    introBonusMs: d.introBonusMs,
    landMs: d.landMs,
    landBigMs: d.landBigMs,
    landWrongMs: d.landWrongMs,
    timeoutCostsAura: d.timeoutCostsAura,
    furyEnabled: d.furyEnabled,
    furyPerCustomer: d.furyPerCustomer,
    furyCorrect: d.furyCorrect,
    // presses count once the sign starts rising (its colour is visible); the talking fallback is signUp + 1600
    minAnswerMs: d.enterMs + 120,
    speakMaxMs: signUpMs + 1600,
    fixedOrder: d.fixedFirst ? d.fixedFirst.slice() : null,
    keyWeights: d.weights ? { ...d.weights } : null,
    ...extra,
  };
}

/** Customers allowed on day n (by id list and/or category), without the 249 trap before day 6. */
export function poolForDay(n, customers) {
  const { pool } = dayInfo(n);
  const ids = new Set(pool.ids || []);
  const cats = new Set(pool.cats || []);
  const exclude = new Set(pool.exclude || []);
  if (!pool.allow249) exclude.add(TRAP_249);
  const out = customers.filter((c) => !exclude.has(c.id) && (ids.has(c.id) || cats.has(c.cat)));
  return out.length ? out : customers.slice();
}
