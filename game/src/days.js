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
//   before the punch half of a clerk line), timeoutCostsAura, furyEnabled, furyPerCustomer, furyCorrect, furyPerfect,
//   furyCutIn, furyJab, furyMult / furyMultUntilMs (gameplay-v2 4: fury is earned by skill; furyMult scales every
//   gain until furyMultUntilMs),
//   showAura / showFury (true | false | 'intro' = hidden until the day's intro shows it), pool { cats, ids, exclude },
//   fixedFirst (first customers by id), weights (by answer key), star1 (★1 queue threshold; null = boss day: ★1 is
//   beating the boss; re-tuned for gameplay v2 stage 2 with tools/bots.mjs: above every masher run, below every normal
//   run, seeds 1–3),
//   chargeBonus (queue bonus per charge level; zero before day 4 introduces hold-to-charge),
//   intro (id of the day's new-system intro: 'opening' | 'aura' | 'rage' | 'charge' | null),
//   talkLeadMs (the answer window t0 opens this long before the customer's voice ends; day 1 only, for pace),
//   original (null | { atMs }: the two-step original-film customer, once per round from atMs on)
//
// Gameplay v2 stage 2 (docs/gameplay-v2.md 5–6), per day:
//   rule ('open' | 'quick' | 'original' | 'meter' | 'phone' | 'crowd' | 'boss': the day's new thing, its name and one-line
//   rule text live in SYSTEM.days[n]), preview (next customers shown under the counter), quickAt (correct answers in a
//   row before fast mouth; 0 = none), quickEnterMs (head pop in fast mouth), quickLandMs, specials ([{ type: 'original' |
//   'group' | 'change' | 'boss', atMs }]: main.js turns them into engine specials with specialsForDay()), meter (day 4:
//   the 250 ticket meter), events ([{ type, atMs }], src/events.js), shutterMs (the last N ms: 拉鐵捲門),
//   star2 / star3 (stat conditions on the engine summary, see meets()), ratingRef (the queue that rating tiers scale
//   from when star1 is not a number: the boss day).
//
//   evaluateDay(n, summary) → { stars: [★1, ★2, ★3], count, rating: 'C'|'B'|'A'|'S', gold }   (gold: S and the queue
//   ends in 250)
//   meets(cond, summary)      cond { stat, min?, max? } or { all: [cond, ...] }
//   specialsForDay(n, { original, change, boss })   engine specials ([{ customer | type, atMs }]) for day n

export const DAY_COUNT = 7;

// Customer categories (the `cat` field of content.zh.js; the engine always runs on zh customers).
const CAT = {
  hesitate: '猶豫磨嘰',
  sweet: '甜度冰塊',
  topping: '加料改料',
  cheap: '貪小便宜',
  count: '數量',
  rush: '催單取餐',
  pay: '付款發票',
  influencer: '拍照網紅',
  work: '職場社會',
  weird: '奇葩要求',
};

// 4.3: day 1 pool (gun 45% / take 30% / shut 25%), fixed opening trio 41 → 46 → 12.
const DAY1_IDS = [1, 6, 7, 8, 41, 42, 43, 44, 45, 5, 15, 46, 47, 49, 50, 11, 12, 13, 14, 16, 18];
const TRAP_249 = 48;

const BASE = {
  timeoutCostsAura: true,
  furyEnabled: true,
  furyPerCustomer: 0, // gameplay-v2 4: arrivals add no fury; cut-in +14, perfect +10, correct +6, jab +2
  furyCorrect: 6,
  furyPerfect: 10,
  furyCutIn: 14,
  furyJab: 2,
  furyMult: 1,
  furyMultUntilMs: Infinity,
  chargeBonus: [0, 1, 2], // hold-to-charge queue bonus (level 0 / 1 / 2); 0 until day 4 introduces it (7)
  showAura: true,
  showFury: true,
  fixedFirst: null,
  weights: null,
  intro: null,
  original: null,
  talkLeadMs: 0,
  // stage 2 (days 2+ turn these on)
  rule: null,
  preview: 0,
  quickAt: 0,
  quickEnterMs: 180,
  quickLandMs: 250,
  specials: [],
  meter: false,
  events: [],
  shutterMs: 0,
  star2: null,
  star3: null,
  ratingRef: null,
};

// Days 2+: the next two customers' mini signs, fast mouth after five correct in a row, the last 5 s 拉鐵捲門.
const V2 = { preview: 2, quickAt: 5, shutterMs: 5000 };

// 4.2 table: W / bonus / L / L+ / wrong / enter / rate / punch gap.
export const DAYS = [
  {
    ...BASE, day: 1, durationMs: 45000, windowStartMs: 2400, windowEndMs: 2400, introBonusMs: 300,
    landMs: 650, landBigMs: 1100, landWrongMs: 550, enterMs: 300, custRate: 1.0, punchGapMs: 200,
    timeoutCostsAura: false, furyEnabled: false, furyPerCustomer: 0, furyCorrect: 0, showAura: false, showFury: false,
    pool: { ids: DAY1_IDS }, fixedFirst: [41, 46, 12], weights: { gun: 0.45, take: 0.30, shut: 0.25 },
    star1: 30, intro: 'opening', talkLeadMs: 400, chargeBonus: [0, 0, 0],
    rule: 'open', star2: { stat: 'maxCombo', min: 8 }, star3: { stat: 'cutInHesitant', min: 1 },
  },
  {
    ...BASE, day: 2, durationMs: 90000, windowStartMs: 2100, windowEndMs: 2100, introBonusMs: 300,
    landMs: 550, landBigMs: 950, landWrongMs: 450, enterMs: 260, custRate: 1.0, punchGapMs: 200,
    furyEnabled: false, furyPerCustomer: 0, furyCorrect: 0, showAura: 'intro', showFury: false,
    pool: { ids: DAY1_IDS, cats: [CAT.hesitate, CAT.count, CAT.sweet] }, star1: 130, intro: 'aura', chargeBonus: [0, 0, 0],
    ...V2, rule: 'quick', events: [{ type: 'megaphone', atMs: 45000 }],
    star2: { stat: 'quickBest', min: 15 }, star3: { stat: 'quickCutIns', min: 3 },
  },
  {
    ...BASE, day: 3, durationMs: 90000, windowStartMs: 1850, windowEndMs: 1850, introBonusMs: 200,
    landMs: 450, landBigMs: 850, landWrongMs: 380, enterMs: 230, custRate: 1.04, punchGapMs: 180,
    furyMult: 2, furyMultUntilMs: 30000, // the first rage (the day's new system) comes at about 25 s for a normal player
    pool: { ids: DAY1_IDS, cats: [CAT.hesitate, CAT.count, CAT.sweet, CAT.topping] }, star1: 130, intro: 'rage',
    chargeBonus: [0, 0, 0],
    original: { atMs: 30000 }, // after the first rage (about 15–20 s): one new thing at a time
    ...V2, rule: 'original',
    // 原片日: the two-step original customer 4–6 times (deferred while rage is ahead)
    specials: [12000, 27000, 42000, 57000, 70000].map((atMs) => ({ type: 'original', atMs })),
    events: [{ type: 'stamp', atMs: 62000 }],
    star2: { stat: 'originals', min: 4 }, star3: { stat: 'originalsFast', min: 1 },
  },
  {
    ...BASE, day: 4, durationMs: 90000, windowStartMs: 1650, windowEndMs: 1650, introBonusMs: 200,
    landMs: 380, landBigMs: 750, landWrongMs: 320, enterMs: 200, custRate: 1.06, punchGapMs: 160,
    pool: { ids: DAY1_IDS, cats: [CAT.hesitate, CAT.count, CAT.sweet, CAT.topping, CAT.cheap] }, star1: 150, intro: 'charge',
    original: { atMs: 40000 },
    ...V2, rule: 'meter', meter: true, specials: [{ type: 'original', atMs: 40000 }],
    events: [{ type: 'calculator', atMs: 52000 }],
    star2: { stat: 'meterHits', min: 1 }, star3: { stat: 'meter249plus1', min: 1 },
  },
  {
    ...BASE, day: 5, durationMs: 90000, windowStartMs: 1450, windowEndMs: 1450, introBonusMs: 200,
    landMs: 320, landBigMs: 650, landWrongMs: 280, enterMs: 180, custRate: 1.08, punchGapMs: 140,
    pool: { ids: DAY1_IDS, cats: [CAT.hesitate, CAT.count, CAT.sweet, CAT.topping, CAT.cheap, CAT.rush, CAT.pay] },
    star1: 140, original: { atMs: 40000 },
    // 回嘴日: the comeback mechanic is stage 3; the ex-boss's phone call is the day's event
    ...V2, rule: 'phone', specials: [{ type: 'original', atMs: 60000 }],
    events: [{ type: 'phone', atMs: 38000 }],
    star2: { all: [{ stat: 'phoneHungUp', min: 1 }, { stat: 'polite', max: 0 }] }, star3: { stat: 'phoneFast', min: 1 },
  },
  {
    ...BASE, day: 6, durationMs: 90000, windowStartMs: 1400, windowEndMs: 1400, introBonusMs: 200,
    landMs: 320, landBigMs: 650, landWrongMs: 280, enterMs: 180, custRate: 1.08, punchGapMs: 140,
    pool: { cats: Object.values(CAT), allow249: true }, star1: 170, original: { atMs: 40000 },
    // 晚八點人潮: group boxes and change-order customers (and the 249 trap in the pool)
    ...V2, rule: 'crowd',
    specials: [
      ...[15000, 33000, 51000, 68000].map((atMs) => ({ type: 'group', atMs })),
      ...[24000, 42000, 60000].map((atMs) => ({ type: 'change', atMs })),
    ].sort((a, b) => a.atMs - b.atMs),
    events: [{ type: 'megaphone', atMs: 76000 }],
    star2: { stat: 'groupsCleared', min: 3 }, star3: { stat: 'charged1cupGun', min: 1 },
  },
  {
    ...BASE, day: 7, durationMs: 90000, windowStartMs: 1400, windowEndMs: 1400, introBonusMs: 200,
    landMs: 320, landBigMs: 650, landWrongMs: 280, enterMs: 180, custRate: 1.08, punchGapMs: 140,
    pool: { cats: Object.values(CAT), allow249: true }, star1: null, original: { atMs: 40000 },
    // Boss: the ex-boss queues up (★1 = beat him); no other special
    ...V2, rule: 'boss', specials: [{ type: 'boss', atMs: 20000 }],
    events: [{ type: 'stamp', atMs: 70000 }],
    star2: { all: [{ stat: 'bossBeaten', min: 1 }, { stat: 'bossTimeouts', max: 0 }] },
    star3: { stat: 'bossHagglePerfect', min: 1 },
    ratingRef: 100,
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
    furyPerfect: d.furyPerfect,
    furyCutIn: d.furyCutIn,
    furyJab: d.furyJab,
    furyMult: d.furyMult,
    furyMultUntilMs: d.furyMultUntilMs,
    chargeBonus: d.chargeBonus.slice(),
    // presses count once the sign starts rising (its colour is visible); the talking fallback is signUp + 1600
    minAnswerMs: d.enterMs + 120,
    // a cut-in (×2) needs the customer to be talking: their line starts once the sign is up
    cutInFromMs: signUpMs,
    speakMaxMs: signUpMs + 1600,
    fixedOrder: d.fixedFirst ? d.fixedFirst.slice() : null,
    keyWeights: d.weights ? { ...d.weights } : null,
    // stage 2
    preview: d.preview,
    quickAt: d.quickAt,
    // silent customers (fast mouth, groups): the sign rises 40 ms after the head (not 120), sign up = enter + 200
    quickMinAnswerMs: d.quickEnterMs + 40,
    quickCutInFromMs: d.quickEnterMs + 200,
    quickSpeakMs: d.quickEnterMs + 200 + 120, // nobody talks: t0 = sign up + 120 ms (the cut-in window)
    quickLandMs: d.quickLandMs,
    meter: d.meter,
    events: d.events.length ? d.events.map((e) => ({ ...e })) : null,
    shutterMs: d.shutterMs,
    specials: specialsForDay(n, {}),
    ...extra,
  };
}

/**
 * Engine specials for day n. Group boxes are built by the engine; the original / change-order / boss customers come
 * from content (main.js passes them). A special whose customer is missing is left out.
 */
export function specialsForDay(n, { original, change, boss } = {}) {
  const by = { original, change, boss };
  const out = [];
  for (const sp of dayInfo(n).specials || []) {
    if (sp.type === 'group') out.push({ type: 'group', atMs: sp.atMs });
    else if (by[sp.type]) out.push({ customer: by[sp.type], atMs: sp.atMs });
  }
  return out.length ? out : null;
}

/** cond { stat, min?, max? } or { all: [...] } against an engine summary (booleans count as 1 / 0). */
export function meets(cond, summary = {}) {
  if (!cond) return false;
  if (Array.isArray(cond.all)) return cond.all.every((c) => meets(c, summary));
  const v = Number(summary[cond.stat] === true ? 1 : summary[cond.stat] || 0);
  if (cond.min != null && !(v >= cond.min)) return false;
  if (cond.max != null && !(v <= cond.max)) return false;
  return true;
}

/**
 * Stars and rating of a finished day (gameplay-v2 6). ★1: the queue threshold (boss day: the boss beaten); ★2 the day's
 * rule goal; ★3 the blackboard riddle. Rating: C below ★1; then one point each for queue ≥ 1.5 ref, ≥ 2.5 ref,
 * ≥ 3.5 ref (ref = ★1, or ratingRef on the boss day), ★2 and ★3: B (0–2), A (3), S (4–5). Tuned with tools/bots.mjs: a
 * player who reads every sign and answers 0.7 s after t0 gets B (A with the riddle), one who cuts in gets A–S.
 * Gold "250": S and the queue ends in 250.
 */
export function evaluateDay(n, summary = {}) {
  const d = dayInfo(n);
  const queue = Math.max(0, Math.floor(summary.queue || 0));
  const s1 = d.star1 != null ? queue >= d.star1 : !!summary.bossBeaten;
  const s2 = meets(d.star2, summary);
  const s3 = meets(d.star3, summary);
  const ref = d.star1 ?? d.ratingRef ?? 100;
  let rating = 'C';
  if (s1) {
    const pts = (queue >= 1.5 * ref) + (queue >= 2.5 * ref) + (queue >= 3.5 * ref) + s2 + s3;
    rating = pts >= 4 ? 'S' : pts >= 3 ? 'A' : 'B';
  }
  const gold = rating === 'S' && queue % 1000 === 250;
  const stars = [s1, s2, s3];
  return { stars, count: stars.filter(Boolean).length, rating, gold, mask: (s1 ? 1 : 0) | (s2 ? 2 : 0) | (s3 ? 4 : 0) };
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
