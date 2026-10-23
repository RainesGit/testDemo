// days.js — days 1–5 of gameplay v3 (docs/gameplay-v3-shop.md 5, 10 and "實作數值" 10.6): menu, pace, goal, new things.
// Pure data, tuned with tools/shop-sim.mjs. No DOM.
//
//   DAYS[n-1] = { n, goal, lengthMs, teas, toppings, ice, sugar, twoTopShare, plainShare, cups, bigShare,
//                 arriveMs, patienceMs, okeShare, newOke, newStuff, script }
//     goal         money to earn today (the day card shows it; making it moves on to the next day)
//     teas/toppings  what orders may ask for (the stations shown); ice / sugar: those stations are in play
//     twoTopShare  share of drinks with two different toppings; plainShare: share with no topping
//     cups         [share of 2-cup orders, share of 3-cup orders] (every cup of an order can differ)
//     bigShare     share of big-order customers (4 cups, pay more; day 3 on)
//     arriveMs     mean gap between arrivals at ★1 (fame shortens it, engine.arrivalGap)
//     patienceMs   a one-cup customer's patience at the counter (more cups: engine.patienceFor)
//     okeShare     share of arrivals that are 奧客
//     newOke       the 奧客 introduced today (the first 奧客 of the day is one of them)
//     newStuff     icons for the day card: tea / topping / station / oke ids, 'two' | 'three' | 'big' (order sizes)
//     script       fixed arrivals [{ at: ms of the open clock, oke }] (day 1: the 250-cup customer)
//   dayDef(n) → the definition (days past 5 repeat day 5, a little faster)
//   MAX_DAY = 5

export const MAX_DAY = 5;
export const DAY_MS = 150000; // 2:30 (spec 5)

export const DAYS = [
  {
    n: 1, goal: 600, lengthMs: DAY_MS,
    teas: ['black'], toppings: ['pearl'], ice: false, sugar: false,
    twoTopShare: 0, plainShare: 0.25, cups: [0, 0], bigShare: 0,
    arriveMs: 9000, patienceMs: 32000, okeShare: 0.14,
    newOke: ['one', 'c250'], newStuff: ['black', 'pearl', 'one', 'c250'],
    script: [{ at: 22000, oke: 'c250' }],
  },
  {
    n: 2, goal: 900, lengthMs: DAY_MS,
    teas: ['black', 'green'], toppings: ['pearl', 'pudding'], ice: false, sugar: false,
    twoTopShare: 0, plainShare: 0.15, cups: [0.25, 0], bigShare: 0,
    arriveMs: 8000, patienceMs: 30000, okeShare: 0.18,
    newOke: ['taste', 'lessIce'], newStuff: ['green', 'pudding', 'two', 'taste', 'lessIce'],
    script: [],
  },
  {
    n: 3, goal: 1250, lengthMs: DAY_MS,
    teas: ['black', 'green', 'jade'], toppings: ['pearl', 'pudding'], ice: true, sugar: false,
    twoTopShare: 0.2, plainShare: 0.1, cups: [0.28, 0], bigShare: 0.08,
    arriveMs: 6800, patienceMs: 28000, okeShare: 0.2,
    newOke: ['cutIn', 'bucket'], newStuff: ['jade', 'ice', 'big', 'cutIn', 'bucket'],
    script: [],
  },
  {
    n: 4, goal: 1300, lengthMs: DAY_MS,
    teas: ['black', 'green', 'jade'], toppings: ['pearl', 'pudding', 'grass'], ice: true, sugar: true,
    twoTopShare: 0.3, plainShare: 0.08, cups: [0.28, 0.12], bigShare: 0.08,
    arriveMs: 6400, patienceMs: 33000, okeShare: 0.2,
    newOke: ['phone'], newStuff: ['grass', 'sugar', 'three', 'phone'],
    script: [],
  },
  {
    n: 5, goal: 1450, lengthMs: DAY_MS,
    teas: ['black', 'green', 'jade'], toppings: ['pearl', 'pudding', 'grass'], ice: true, sugar: true,
    twoTopShare: 0.3, plainShare: 0.08, cups: [0.3, 0.15], bigShare: 0.1,
    arriveMs: 6000, patienceMs: 33000, okeShare: 0.22,
    newOke: ['live'], newStuff: ['live'],
    script: [],
  },
];

export function dayDef(n) {
  const i = Math.max(1, Math.floor(Number(n) || 1));
  if (i <= MAX_DAY) return DAYS[i - 1];
  // past day 5 (free play): day 5, a bit busier and a higher goal each day
  const d = DAYS[MAX_DAY - 1];
  const k = i - MAX_DAY;
  return { ...d, n: i, goal: d.goal + 300 * k, arriveMs: Math.max(4200, d.arriveMs - 250 * k), newOke: [], newStuff: [], script: [] };
}
