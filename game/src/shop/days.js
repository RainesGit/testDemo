// days.js — days 1–5 of gameplay v3 (docs/gameplay-v3-shop.md 5 and "實作數值"): menu, pace, goal, new things.
// Pure data, tuned with tools/shop-sim.mjs. No DOM.
//
//   DAYS[n-1] = { n, goal, lengthMs, teas, toppings, ice, sugar, twoTopShare, plainShare, twoCupShare,
//                 arriveMs, patienceMs, okeShare, newOke, newStuff, script }
//     goal         money to earn today (the day card shows it; making it moves on to the next day)
//     teas/toppings  what orders may ask for (the stations shown); ice / sugar: those stations are in play
//     twoTopShare  share of orders with two different toppings; plainShare: share with no topping
//     twoCupShare  share of orders for two cups (day 5)
//     arriveMs     mean gap between arrivals at ★1 (fame shortens it, engine.arrivalGap)
//     patienceMs   a normal customer's patience (two cups: ×1.4)
//     okeShare     share of arrivals that are 奧客
//     newOke       the 奧客 introduced today (the first 奧客 of the day is one of them)
//     newStuff     icons for the day card: tea / topping / station / oke ids
//     script       fixed arrivals [{ at: ms of the open clock, oke }] (day 1: the 250-cup customer)
//   dayDef(n) → the definition (days past 5 repeat day 5, a little faster)
//   MAX_DAY = 5

export const MAX_DAY = 5;
export const DAY_MS = 150000; // 2:30 (spec 5)

export const DAYS = [
  {
    n: 1, goal: 600, lengthMs: DAY_MS,
    teas: ['black'], toppings: ['pearl'], ice: false, sugar: false,
    twoTopShare: 0, plainShare: 0.25, twoCupShare: 0,
    arriveMs: 10500, patienceMs: 30000, okeShare: 0.14,
    newOke: ['one', 'c250'], newStuff: ['black', 'pearl', 'one', 'c250'],
    script: [{ at: 22000, oke: 'c250' }],
  },
  {
    n: 2, goal: 900, lengthMs: DAY_MS,
    teas: ['black', 'green'], toppings: ['pearl', 'pudding'], ice: false, sugar: false,
    twoTopShare: 0, plainShare: 0.15, twoCupShare: 0,
    arriveMs: 8200, patienceMs: 26000, okeShare: 0.18,
    newOke: ['taste', 'lessIce'], newStuff: ['green', 'pudding', 'taste', 'lessIce'],
    script: [],
  },
  {
    n: 3, goal: 1300, lengthMs: DAY_MS,
    teas: ['black', 'green', 'jade'], toppings: ['pearl', 'pudding'], ice: true, sugar: false,
    twoTopShare: 0.2, plainShare: 0.1, twoCupShare: 0,
    arriveMs: 6600, patienceMs: 24000, okeShare: 0.2,
    newOke: ['cutIn', 'bucket'], newStuff: ['jade', 'ice', 'cutIn', 'bucket'],
    script: [],
  },
  {
    n: 4, goal: 1350, lengthMs: DAY_MS,
    teas: ['black', 'green', 'jade'], toppings: ['pearl', 'pudding', 'grass'], ice: true, sugar: true,
    twoTopShare: 0.3, plainShare: 0.08, twoCupShare: 0,
    arriveMs: 6000, patienceMs: 26000, okeShare: 0.2,
    newOke: ['phone'], newStuff: ['grass', 'sugar', 'phone'],
    script: [],
  },
  {
    n: 5, goal: 1500, lengthMs: DAY_MS,
    teas: ['black', 'green', 'jade'], toppings: ['pearl', 'pudding', 'grass'], ice: true, sugar: true,
    twoTopShare: 0.3, plainShare: 0.08, twoCupShare: 0.25,
    arriveMs: 5800, patienceMs: 27000, okeShare: 0.22,
    newOke: ['live'], newStuff: ['two', 'live'],
    script: [],
  },
];

export function dayDef(n) {
  const i = Math.max(1, Math.floor(Number(n) || 1));
  if (i <= MAX_DAY) return DAYS[i - 1];
  // past day 5 (free play): day 5, a bit busier and a higher goal each day
  const d = DAYS[MAX_DAY - 1];
  const k = i - MAX_DAY;
  return { ...d, n: i, goal: d.goal + 250 * k, arriveMs: Math.max(4200, d.arriveMs - 250 * k), newOke: [], newStuff: [], script: [] };
}
