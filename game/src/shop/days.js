// days.js — days 1–5 of gameplay v3 (docs/gameplay-v3-shop.md 5, 10, "實作數值" 10.6 and the new stations 10.9): menu, pace, goal, new things.
// Pure data, tuned with tools/shop-sim.mjs. No DOM.
//
//   DAYS[n-1] = { n, goal, lengthMs, teas, toppings, ice, sugar, milkShare, foamShare, snackShare, lemon, shake, bag,
//                 twoTopShare, plainShare, cups, bigShare, arriveMs, patienceMs, okeShare, newOke, newStuff, script }
//     goal         money to earn today (the day card shows it; making it moves on to the next day)
//     teas/toppings  what orders may ask for (the stations shown); ice / sugar: those stations are in play
//     milkShare    share of black / green drinks ordered as milk tea (鮮奶 pump; 10.9); 0 = the pump is not out yet
//     foamShare    share of drinks with a cheese-foam top (奶蓋機); 0 = not yet
//     snackShare   share of orders (not big ones) that add one bag of 雞蛋糕 (the waffle-ball iron); 0 = not yet
//     lemon        翡翠檸檬 needs a lemon slice from the cutting board (every jade drink)
//     shake        every drink is shaken (搖杯機) before it is sealed
//     bag          big 4-cup orders are packed into a carry bag (提袋) and handed over as one bag
//     twoTopShare  share of drinks with two different toppings; plainShare: share with no topping
//     cups         [share of 2-cup orders, share of 3-cup orders] (every cup of an order can differ)
//     bigShare     share of big-order customers (4 cups, pay more; day 3 on)
//     arriveMs     mean gap between arrivals at ★1 (fame shortens it, engine.arrivalGap)
//     patienceMs   a one-cup customer's patience at the counter (more cups: engine.patienceFor)
//     okeShare     share of arrivals that are 奧客
//     newOke       the 奧客 introduced today (the first 奧客 of the day is one of them)
//     newStuff     icons for the day card: tea / topping / station ids ('milk' 'shake' 'foam' 'snack' 'ice' 'sugar'), oke ids,
//                  'two' | 'three' | 'big' (order sizes; 'big' from day 3 = the carry bag)
//     script       fixed arrivals [{ at: ms of the open clock, oke }] (day 1: the 250-cup customer)
//   dayDef(n) → the definition (days past 5 repeat day 5, a little faster)
//   MAX_DAY = 5

export const MAX_DAY = 5;
export const DAY_MS = 150000; // 2:30 (spec 5)

export const DAYS = [
  {
    n: 1, goal: 600, lengthMs: DAY_MS,
    teas: ['black'], toppings: ['pearl'], ice: false, sugar: false,
    milkShare: 0, foamShare: 0, snackShare: 0, lemon: false, shake: false, bag: false,
    twoTopShare: 0, plainShare: 0.25, cups: [0, 0], bigShare: 0,
    arriveMs: 9000, patienceMs: 32000, okeShare: 0.14,
    newOke: ['one', 'c250'], newStuff: ['black', 'pearl', 'one', 'c250'],
    script: [{ at: 22000, oke: 'c250' }],
  },
  {
    n: 2, goal: 850, lengthMs: DAY_MS,
    teas: ['black', 'green'], toppings: ['pearl', 'pudding'], ice: false, sugar: false,
    milkShare: 0.35, foamShare: 0, snackShare: 0, lemon: false, shake: false, bag: false,
    twoTopShare: 0, plainShare: 0.15, cups: [0.25, 0], bigShare: 0,
    arriveMs: 8200, patienceMs: 33000, okeShare: 0.18,
    newOke: ['taste', 'lessIce'], newStuff: ['green', 'pudding', 'milk', 'two', 'taste', 'lessIce'],
    script: [],
  },
  {
    n: 3, goal: 1050, lengthMs: DAY_MS,
    teas: ['black', 'green', 'jade'], toppings: ['pearl', 'pudding', 'taro'], ice: true, sugar: false,
    milkShare: 0.35, foamShare: 0, snackShare: 0, lemon: true, shake: true, bag: true,
    twoTopShare: 0.2, plainShare: 0.1, cups: [0.28, 0], bigShare: 0.08,
    arriveMs: 7000, patienceMs: 35000, okeShare: 0.2,
    newOke: ['cutIn', 'bucket'], newStuff: ['jade', 'taro', 'ice', 'shake', 'big', 'cutIn', 'bucket'],
    script: [],
  },
  {
    n: 4, goal: 1150, lengthMs: DAY_MS,
    teas: ['black', 'green', 'jade'], toppings: ['pearl', 'pudding', 'taro', 'grass'], ice: true, sugar: true,
    milkShare: 0.35, foamShare: 0.25, snackShare: 0.2, lemon: true, shake: true, bag: true,
    twoTopShare: 0.3, plainShare: 0.08, cups: [0.28, 0.1], bigShare: 0.08,
    arriveMs: 6600, patienceMs: 38000, okeShare: 0.2,
    newOke: ['phone'], newStuff: ['grass', 'sugar', 'foam', 'snack', 'three', 'phone'],
    script: [],
  },
  {
    n: 5, goal: 1300, lengthMs: DAY_MS,
    teas: ['black', 'green', 'jade'], toppings: ['pearl', 'pudding', 'taro', 'grass', 'bean'], ice: true, sugar: true,
    milkShare: 0.35, foamShare: 0.25, snackShare: 0.25, lemon: true, shake: true, bag: true,
    twoTopShare: 0.3, plainShare: 0.08, cups: [0.3, 0.12], bigShare: 0.1,
    arriveMs: 6200, patienceMs: 38000, okeShare: 0.22,
    newOke: ['live'], newStuff: ['bean', 'live'],
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
