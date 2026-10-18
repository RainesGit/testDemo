// shop-sim.mjs — balance sim for gameplay v3 (docs/gameplay-v3-shop.md "實作數值"): scripted players run days 1–5 on
// the pure engine (src/shop/engine.js), carrying fame and money over and buying upgrades between days like a player
// would (cheapest useful first). No browser.
//
// Players (one action per reaction time; a drag counts as one action):
//   rookie  1300 ms per action, 8% slips, answers a 奧客 after 4 s, best answer 40% (a first-time player)
//   new     900 ms per action, 6% slips (a wrong topping / tap), answers a 奧客 after 3 s, best answer half the time
//   normal  650 ms, 3% slips, 奧客 after 1.8 s, best answer 70%
//   expert  420 ms, 1% slips, 奧客 after 0.9 s, always the best answer
// Per day: earned vs goal (and how often it was met), served / wrong / walk-outs, 奧客 answered, mean customers
// waiting at the counter ("hectic": share of time with every seat taken), stars at the end of the day.
// Usage: node tools/shop-sim.mjs [--seeds=20] [--bots=new,normal,expert] [--days=5] [--noUpgrades]
import { createShop, sameDrink } from '../src/shop/engine.js';
import { DAYS } from '../src/shop/days.js';
import { UPGRADES } from '../src/shop/upgrades.js';
import { okeOf } from '../src/shop/oke.js';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const SEEDS = Number(arg('seeds', 20));
const BOTS = arg('bots', 'rookie,new,normal,expert').split(',');
const NDAYS = Number(arg('days', 5));
const NO_UP = process.argv.includes('--noUpgrades');

export const BOT = {
  rookie: { react: 1300, slip: 0.08, okeDelay: 4000, bestP: 0.4 },
  new: { react: 900, slip: 0.06, okeDelay: 3000, bestP: 0.5 },
  normal: { react: 650, slip: 0.03, okeDelay: 1800, bestP: 0.7 },
  expert: { react: 420, slip: 0.01, okeDelay: 900, bestP: 1 },
};
// the order a player buys upgrades in (cheap speed-ups first)
const BUY_ORDER = ['bigPot', 'fastSeal', 'slot3', 'coconut', 'ticket', 'neon', 'megaphone', 'seat4'];

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Plays one day; returns the engine summary plus sim metrics. */
export function playDay({ day, fame, upgrades, seed, bot, guide = false }) {
  const b = BOT[bot];
  const shop = createShop({ day, fame, upgrades, seed, guide });
  const s = shop.state;
  const r = rng(seed * 7919 + day);
  const STEP = 50;
  let busyUntil = 0;
  const jobs = new Map(); // work slot -> { uid, steps: [...] }
  let fullMs = 0;
  let waitSum = 0;
  let samples = 0;
  const custAt = (uid) => s.slots.findIndex((c) => c && c.uid === uid);
  const needs = (c) => c && (c.kind === 'normal' || c.converted) && c.order;
  const inMaking = (uid) => [...jobs.values()].filter((j) => j.uid === uid).length;

  function stepsFor(order) {
    const st = [['tea', order.tea]];
    for (const k of order.toppings) st.push(['top', k]);
    for (let i = 0; i < order.ice; i++) st.push(['ice']);
    for (let i = 0; i < order.sugar; i++) st.push(['sugar']);
    // a slip: one extra tap of something (the bot notices only when serving: it serves anyway, half pay)
    if (r() < b.slip * st.length) st.push(s.def.ice ? ['ice'] : ['top', s.def.toppings[0]]);
    st.push(['seal']);
    return st;
  }

  function act() {
    // 1. serve a sealed cup
    for (let w = 0; w < s.work.length; w++) {
      const cup = s.work[w];
      if (!cup || !cup.sealed) continue;
      const j = jobs.get(w);
      let slot = j ? custAt(j.uid) : -1;
      if (slot < 0) slot = s.slots.findIndex((c) => needs(c) && sameDrink(cup, c.order));
      if (slot < 0) { shop.trash(w); jobs.delete(w); return true; }
      shop.serve(w, slot);
      jobs.delete(w);
      return true;
    }
    // 2. a 奧客 waiting long enough
    for (let i = 0; i < s.slots.length; i++) {
      const c = s.slots[i];
      if (c && c.kind === 'oke' && !c.converted && s.t - c.seatedAt >= b.okeDelay) {
        const best = okeOf(c.oke).best;
        const key = r() < b.bestP ? best : ['gun', 'shut', 'take'][Math.floor(r() * 3)];
        shop.answer(i, key);
        return true;
      }
    }
    // 3. pearls
    if (s.pot.scoops <= 1 && !s.pot.cookingUntil) { shop.cook(); return true; }
    // 4. continue a job
    for (const [w, j] of jobs) {
      const cup = s.work[w];
      if (!cup || cup.sealed || cup.sealingUntil) continue;
      if (custAt(j.uid) < 0) { shop.trash(w); jobs.delete(w); return true; }
      const step = j.steps[0];
      if (!step) continue;
      shop.select(w);
      let res;
      if (step[0] === 'tea') res = shop.addTea(step[1]);
      else if (step[0] === 'top') res = shop.addTopping(step[1]);
      else if (step[0] === 'ice') res = shop.tapIce();
      else if (step[0] === 'sugar') res = shop.tapSugar();
      else if (step[0] === 'seal') res = shop.seal(w);
      if (res && res.ok) { j.steps.shift(); return true; }
      if (res && (res.reason === 'pouring' || res.reason === 'sealerBusy' || res.reason === 'potEmpty')) continue;
      j.steps.shift();
      return true;
    }
    // 5. start a drink for the most impatient customer who still needs one
    const free = s.work.findIndex((c) => !c);
    if (free >= 0) {
      const cands = s.slots.filter((c) => needs(c) && c.delivered + inMaking(c.uid) < c.order.count)
        .sort((x, y) => x.patience / x.patienceMax - y.patience / y.patienceMax);
      if (cands.length) {
        const c = cands[0];
        const res = shop.takeCup();
        if (res.ok) jobs.set(res.w, { uid: c.uid, steps: stepsFor(c.order) });
        return true;
      }
    }
    return false;
  }

  // the guide (day 1): the bot just follows it
  let guard = 0;
  while (s.phase !== 'closed' && guard++ < 200000) {
    if (s.t >= busyUntil) {
      if (act()) busyUntil = s.t + b.react * (0.8 + r() * 0.4);
    }
    shop.tick(STEP);
    if (s.phase === 'open') {
      const seated = s.slots.filter(Boolean).length;
      if (seated === s.slots.length) fullMs += STEP;
      waitSum += seated;
      samples += 1;
    }
  }
  const sum = shop.summary();
  return { ...sum, hectic: fullMs / (s.length || 1), meanSeated: waitSum / Math.max(1, samples) };
}

function runCareer(bot, seed) {
  let fame = 0;
  let wallet = 0;
  const upgrades = [];
  const out = [];
  for (let day = 1; day <= NDAYS; day++) {
    let res = playDay({ day, fame, upgrades: [...upgrades], seed, bot, guide: day === 1 });
    let tries = 1;
    // a failed day is replayed (money and fame are kept), at most 3 times
    while (!res.met && tries < 3) {
      wallet += Math.max(0, res.earned); fame = res.fame;
      res = playDay({ day, fame, upgrades: [...upgrades], seed: seed + 100 * tries, bot });
      tries += 1;
    }
    wallet += Math.max(0, res.earned);
    fame = res.fame;
    out.push({ ...res, tries, upgradesOwned: upgrades.length });
    if (!NO_UP) {
      for (const id of BUY_ORDER) {
        const u = UPGRADES.find((x) => x.id === id);
        if (!upgrades.includes(id) && wallet >= u.cost) { wallet -= u.cost; upgrades.push(id); }
      }
    }
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  for (const bot of BOTS) {
    const per = DAYS.slice(0, NDAYS).map(() => []);
    for (let seed = 1; seed <= SEEDS; seed++) runCareer(bot, seed).forEach((d, i) => per[i].push(d));
    console.log(`\n== ${bot} (${SEEDS} careers${NO_UP ? ', no upgrades' : ''}) ==`);
    console.log('day goal  earned(avg/min) 1st-try  served wrong walk  oke best  seated hectic  stars  upg');
    per.forEach((list, i) => {
      const avg = (f) => list.reduce((a, d) => a + f(d), 0) / list.length;
      const min = Math.min(...list.map((d) => d.earned));
      const first = list.filter((d) => d.tries === 1).length / list.length;
      console.log(
        `${String(i + 1).padStart(3)} ${String(DAYS[i].goal).padStart(5)}  ${avg((d) => d.earned).toFixed(0).padStart(6)}/${String(min).padStart(5)}   ${(first * 100).toFixed(0).padStart(4)}%  ` +
        `${avg((d) => d.served).toFixed(1).padStart(6)} ${avg((d) => d.wrong).toFixed(1).padStart(5)} ${avg((d) => d.walkouts).toFixed(1).padStart(4)}  ` +
        `${avg((d) => d.okeCursed).toFixed(1).padStart(3)} ${avg((d) => d.okeBest).toFixed(1).padStart(4)}  ${avg((d) => d.meanSeated).toFixed(2).padStart(6)} ${(avg((d) => d.hectic) * 100).toFixed(0).padStart(5)}%  ` +
        `${avg((d) => d.stars).toFixed(1).padStart(5)}  ${avg((d) => d.upgradesOwned).toFixed(1).padStart(3)}`);
    });
  }
}
