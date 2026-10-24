// shop-sim.mjs — balance sim for gameplay v3 (docs/gameplay-v3-shop.md 9 and 10.6–10.7): scripted players run days 1–5
// on the pure engine (src/shop/engine.js: customers walk in, queue, step up; shelf; multi-cup orders; the upgrade tree),
// carrying fame and money over and buying upgrades between days like a player would (BUY_ORDER, while affordable).
// No browser.
//
// The 10.9 stations are part of every recipe: milk, lemon (slicing the board when the tray is empty), foam, shaking (until
// the auto shaker), the carry bag for big orders (pack each cup, then one drag of the bag) and the snack (cook, hand over).
// Players (one action per reaction time; a drag counts as one action):
//   rookie  1300 ms per action, 8% slips, answers a 奧客 after 4 s, best answer 40% (a first-time player)
//   new     900 ms per action, 6% slips (a wrong topping / tap), answers a 奧客 after 3 s, best answer half the time
//   normal  650 ms, 3% slips, 奧客 after 1.8 s, best answer 70%
//   expert  420 ms, 1% slips, 奧客 after 0.9 s, always the best answer
// Per day: earned vs goal (and how often it was met on the first try), cups sold, wrong, walk-outs, 奧客 answered,
// fans, mean / peak line outside, "hectic" (share of the open time with every counter spot taken or being stepped
// into), stars at the end, upgrades bought after the day.
// --curse: also compares the normal player cursing nobody extra / curse-happy (curses 25% of normal customers too)
// / never answering 奧客 at their best (bestP 0), to show that cursing lengthens the line and raises income.
// Usage: node tools/shop-sim.mjs [--seeds=20] [--bots=rookie,new,normal,expert] [--days=5] [--noUpgrades] [--curse]
import { createShop, sameDrink } from '../src/shop/engine.js';
import { DAYS } from '../src/shop/days.js';
import { LEVELS, canBuy } from '../src/shop/upgrades.js';
import { okeOf } from '../src/shop/oke.js';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const SEEDS = Number(arg('seeds', 20));
const BOTS = arg('bots', 'rookie,new,normal,expert').split(',');
const NDAYS = Number(arg('days', 5));
const NO_UP = process.argv.includes('--noUpgrades');
const CURSE = process.argv.includes('--curse');

export const BOT = {
  rookie: { react: 1300, slip: 0.08, okeDelay: 4000, bestP: 0.4 },
  new: { react: 900, slip: 0.06, okeDelay: 3000, bestP: 0.5 },
  normal: { react: 650, slip: 0.03, okeDelay: 1800, bestP: 0.7 },
  expert: { react: 420, slip: 0.01, okeDelay: 900, bestP: 1 },
};
// the order a player buys upgrades in (cheap capacity / speed first, automation late)
export const BUY_ORDER = ['pot2', 'milk2', 'seal2', 'shaker2', 'shelf2', 'tea2', 'lemon2', 'rail', 'prep2', 'ice2', 'foam2', 'snack2',
  'menu2', 'sound', 'seal3', 'pot3', 'aircon', 'ticket', 'neon', 'shelf3', 'prep3', 'shaker3', 'mega', 'seat5', 'menu3', 'staff1',
  'snack3', 'tea3', 'pot4', 'seal4', 'staff2'];

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Plays one day; returns the engine summary plus sim metrics. opts: { curseP, bestP } override the bot. */
export function playDay({ day, fame, upgrades, seed, bot, guide = false, def, curseP = 0, bestP }) {
  const b = { ...BOT[bot], ...(bestP != null ? { bestP } : {}) };
  const shop = createShop({ day, fame, upgrades, seed, guide, def });
  const s = shop.state;
  const cfg = shop.cfg;
  const r = rng(seed * 7919 + day);
  const STEP = 50;
  let busyUntil = 0;
  const jobs = new Map(); // cup id -> { uid, k, steps: [...] }
  const cursed = new Set();
  let fullMs = 0;
  let waitSum = 0;
  let lineSum = 0;
  let samples = 0;
  const custAt = (uid) => s.slots.findIndex((c) => c && c.uid === uid);
  const needs = (c) => c && (c.kind === 'normal' || c.converted) && c.order;
  const covered = (uid, k) => [...jobs.values()].some((j) => j.uid === uid && j.k === k);

  function stepsFor(item) {
    const st = [['tea', item.tea]];
    if (item.milk) st.push(['milk']);
    for (const k of item.toppings) st.push(['top', k]);
    if (item.lemon) st.push(['lemon']);
    if (cfg.iceSmart) { if (item.ice) st.push(['ice']); } else for (let i = 0; i < item.ice; i++) st.push(['ice']);
    for (let i = 0; i < item.sugar; i++) st.push(['sugar']);
    if (item.foam) st.push(['foam']);
    // a slip: one extra tap of something (the bot notices only when serving: it serves anyway, half pay)
    if (r() < b.slip * st.length) st.push(s.def.ice ? ['ice'] : ['top', s.def.toppings[0]]);
    if (s.def.shake && !cfg.autoShake) st.push(['shake']);
    st.push(['seal']);
    return st;
  }
  // 提袋: the customer whose cups are in the bag (one customer at a time)
  let bagOwner = null;
  const bigBag = (slot) => slot >= 0 && s.bag && s.slots[slot] && s.slots[slot].order && s.slots[slot].order.big;
  function serveTarget(cup) {
    const j = jobs.get(cup.id);
    if (j) { const slot = custAt(j.uid); if (slot >= 0 && !s.slots[slot].got[j.k]) return slot; }
    // any customer still waiting for that drink (helper cups, orphaned cups)
    return s.slots.findIndex((c) => needs(c) && c.order.items.some((it, k) => !c.got[k] && sameDrink(cup, it)));
  }

  function act() {
    // 0. the carry bag: hand it over once it holds every cup its customer still needs (or bin it if they left)
    if (s.bag && s.bag.cups.length) {
      const slot = custAt(bagOwner);
      const unbag = () => { for (const [id, j] of jobs) if (j.bagged) jobs.delete(id); bagOwner = null; };
      if (slot < 0) { shop.trashBag(); unbag(); return true; }
      const need = s.slots[slot].got.filter((g) => !g).length;
      if (s.bag.cups.length >= need) { shop.serveBag(slot); unbag(); return true; }
    } else bagOwner = null;
    // 1. serve a sealed cup (shelf first, then a sealed cup still on the table); a big order's cups go into the bag
    const give = (cup, ref) => {
      const slot = serveTarget(cup);
      if (slot < 0) {
        if (ref.shelf != null && jobs.has(cup.id) && custAt(jobs.get(cup.id).uid) >= 0) return false;
        if (ref.shelf != null) shop.trashShelf(ref.shelf); else shop.trash(ref.w);
        jobs.delete(cup.id);
        return true;
      }
      if (bigBag(slot)) {
        const uid = s.slots[slot].uid;
        if (bagOwner != null && bagOwner !== uid) return false; // the bag is busy with someone else's order
        if (!shop.pack(ref).ok) return false;
        bagOwner = uid;
        if (jobs.has(cup.id)) jobs.get(cup.id).bagged = true; // still covers its item until the bag goes out
        return true;
      }
      if (ref.shelf != null) shop.serveShelf(ref.shelf, slot); else shop.serve(ref.w, slot);
      jobs.delete(cup.id);
      return true;
    };
    for (let i = 0; i < s.shelf.length; i++) {
      const cup = s.shelf[i];
      if (cup && cup.sealed && give(cup, { shelf: i })) return true;
    }
    for (let w = 0; w < s.work.length; w++) {
      const cup = s.work[w];
      if (cup && cup.sealed && give(cup, { w })) return true;
    }
    // 1b. snacks: hand a ready bag to whoever ordered one; keep the iron going while someone waits for one
    if (s.snack) {
      const want = shop.pendingSnacks();
      if (want.length && s.snack.ready > 0) { shop.serveSnack(want[0]); return true; }
      if (want.length > s.snack.ready && !s.snack.cookingUntil && !cfg.autoSnack) { shop.cookSnack(); return true; }
    }
    // 2. a 奧客 waiting long enough (or a normal customer the curse-happy player picks on)
    for (let i = 0; i < s.slots.length; i++) {
      const c = s.slots[i];
      if (c && c.kind === 'oke' && !c.converted && s.t - c.seatedAt >= b.okeDelay) {
        const best = okeOf(c.oke).best;
        const key = r() < b.bestP ? best : ['gun', 'shut', 'take'].filter((k) => k !== best)[Math.floor(r() * 2)];
        shop.answer(i, key);
        return true;
      }
      if (curseP && c && c.kind === 'normal' && !cursed.has(c.uid) && s.t - c.seatedAt >= b.okeDelay) {
        cursed.add(c.uid);
        if (r() < curseP && !c.got.some(Boolean)) { shop.answer(i, 'gun'); return true; }
      }
    }
    // 3. pearls
    if (s.pot.scoops <= 1 && !s.pot.cookingUntil && !cfg.autoCook) { shop.cook(); return true; }
    // 4. continue a job
    for (let w = 0; w < s.work.length; w++) {
      const cup = s.work[w];
      if (!cup || cup.sealed || cup.sealingUntil || cup.shakingUntil) continue;
      const j = jobs.get(cup.id);
      if (!j) continue;
      if (custAt(j.uid) < 0) { shop.trash(w); jobs.delete(cup.id); return true; }
      const step = j.steps[0];
      if (!step) continue;
      if (step[0] === 'tea' && cup.tea) { j.steps.shift(); continue; } // the manifold filled it already
      if (step[0] === 'lemon' && s.lemon && s.lemon.slices <= 0) {
        if (!s.lemon.slicingUntil) { shop.slice(); return true; } // refill the tray on the board
        continue;
      }
      shop.select(w);
      let res;
      if (step[0] === 'tea') res = shop.addTea(step[1]);
      else if (step[0] === 'milk') res = shop.addMilk();
      else if (step[0] === 'top') res = shop.addTopping(step[1]);
      else if (step[0] === 'lemon') res = shop.addLemon();
      else if (step[0] === 'ice') res = shop.tapIce();
      else if (step[0] === 'sugar') res = shop.tapSugar();
      else if (step[0] === 'foam') res = shop.addFoam();
      else if (step[0] === 'shake') res = shop.shake(w);
      else if (step[0] === 'seal') {
        res = shop.seal(w);
        if (!res.ok && res.reason === 'sealerBusy' && cfg.autoSeal) res = shop.seal(w, { toShelf: true });
      }
      if (res && res.ok) { j.steps.shift(); return true; }
      if (res && (res.reason === 'pouring' || res.reason === 'sealerBusy' || res.reason === 'potEmpty' || res.reason === 'shelfFull' || res.reason === 'shakerBusy')) continue;
      j.steps.shift();
      return true;
    }
    // 5. start a drink for the most impatient customer who still needs one
    const free = s.work.findIndex((c) => !c);
    if (free >= 0) {
      const cands = [];
      s.slots.forEach((c) => {
        if (!needs(c)) return;
        c.order.items.forEach((it, k) => {
          if (c.got[k] || covered(c.uid, k)) return;
          // a matching cup already on the shelf (the helper's) covers it
          if (s.shelf.some((cup) => cup && sameDrink(cup, it) && !jobs.has(cup.id))) return;
          cands.push({ c, k, it, p: c.patience / c.patienceMax });
        });
      });
      cands.sort((x, y) => x.p - y.p);
      if (cands.length) {
        const { c, k, it } = cands[0];
        const res = shop.takeCup();
        if (res.ok) jobs.set(s.work[res.w].id, { uid: c.uid, k, steps: stepsFor(it) });
        return true;
      }
    }
    return false;
  }

  let guard = 0;
  while (s.phase !== 'closed' && guard++ < 200000) {
    if (s.t >= busyUntil) {
      if (act()) busyUntil = s.t + b.react * (0.8 + r() * 0.4);
    }
    shop.tick(STEP);
    if (s.phase === 'open') {
      const seated = s.slots.filter(Boolean).length + s.incoming.filter(Boolean).length;
      if (seated === s.slots.length) fullMs += STEP;
      waitSum += s.slots.filter(Boolean).length;
      lineSum += s.queue.length;
      samples += 1;
    }
  }
  const sum = shop.summary();
  return { ...sum, hectic: fullMs / (s.length || 1), meanSeated: waitSum / Math.max(1, samples), meanLine: lineSum / Math.max(1, samples) };
}

export function runCareer(bot, seed, { days = NDAYS, noUp = NO_UP, opts = {} } = {}) {
  let fame = 0;
  let wallet = 0;
  const upgrades = [];
  const out = [];
  for (let day = 1; day <= days; day++) {
    let res = playDay({ day, fame, upgrades: [...upgrades], seed, bot, guide: day === 1, ...opts });
    let tries = 1;
    // a failed day is replayed (money and fame are kept), at most 3 times
    while (!res.met && tries < 3) {
      wallet += Math.max(0, res.earned); fame = res.fame;
      res = playDay({ day, fame, upgrades: [...upgrades], seed: seed + 100 * tries, bot, ...opts });
      tries += 1;
    }
    wallet += Math.max(0, res.earned);
    fame = res.fame;
    const bought = [];
    if (!noUp) {
      for (const id of BUY_ORDER) {
        const u = LEVELS.find((x) => x.id === id);
        if (canBuy(id, upgrades, wallet)) { wallet -= u.cost; upgrades.push(id); bought.push(id); }
      }
    }
    out.push({ ...res, tries, upgradesOwned: upgrades.length - bought.length, bought, wallet });
  }
  return out;
}

function table(bot, opts = {}, label = '') {
  const per = DAYS.slice(0, NDAYS).map(() => []);
  for (let seed = 1; seed <= SEEDS; seed++) runCareer(bot, seed, { opts }).forEach((d, i) => per[i].push(d));
  console.log(`\n== ${bot}${label} (${SEEDS} careers${NO_UP ? ', no upgrades' : ''}) ==`);
  console.log('day  goal  earned(avg/min) 1st-try  cups wrong walk  oke best  fans  line(avg/max) seated hectic stars  bought');
  per.forEach((list, i) => {
    const avg = (f) => list.reduce((a, d) => a + f(d), 0) / list.length;
    const min = Math.min(...list.map((d) => d.earned));
    const first = list.filter((d) => d.tries === 1).length / list.length;
    console.log(
      `${String(i + 1).padStart(3)} ${String(DAYS[i].goal).padStart(5)}  ${avg((d) => d.earned).toFixed(0).padStart(6)}/${String(min).padStart(5)}   ${(first * 100).toFixed(0).padStart(4)}%  ` +
      `${avg((d) => d.sold).toFixed(1).padStart(5)} ${avg((d) => d.wrong).toFixed(1).padStart(5)} ${avg((d) => d.walkouts).toFixed(1).padStart(4)}  ` +
      `${avg((d) => d.okeCursed).toFixed(1).padStart(3)} ${avg((d) => d.okeBest).toFixed(1).padStart(4)} ${avg((d) => d.fans).toFixed(1).padStart(5)}  ` +
      `${avg((d) => d.meanLine).toFixed(1).padStart(5)}/${avg((d) => d.maxQueue).toFixed(1).padStart(4)}  ${avg((d) => d.meanSeated).toFixed(2).padStart(6)} ${(avg((d) => d.hectic) * 100).toFixed(0).padStart(5)}% ` +
      `${avg((d) => d.stars).toFixed(1).padStart(5)}  ${avg((d) => d.bought.length).toFixed(1)}: ${[...new Set(list.flatMap((d) => d.bought))].slice(0, 6).join(',')}`);
  });
  return per;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  for (const bot of BOTS) table(bot);
  if (CURSE) {
    table('normal', { bestP: 0 }, ' never the best answer');
    table('normal', { curseP: 0.25 }, ' curses 25% of normal customers too');
  }
}
