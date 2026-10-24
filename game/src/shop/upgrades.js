// upgrades.js — the gameplay v3 equipment upgrade tree (docs/gameplay-v3-shop.md 10.7, after Shawarma Legend): every
// station levels up Lv1 → Lv2 → Lv3 (→ Lv4), roughly capacity → speed → automation, plus single-level shop items.
// Bought between days with the wallet. Every level shows on the play screen (ui.js reads applyUpgrades()).
// Pure data + helpers. No DOM. Names / one-line effects live in text.js (upgrades[levelId]).
//
//   STATIONS: [{ id, tab, levels: [{ id, cost, set: { tuning changes } }] }]   (Lv1 = the base, not listed)
//     tab: 'equip' (設備) | 'bar' (吧台: the 10.9 milk pump, shaker, foam, lemon board, waffle iron) | 'menu' (菜單・員工・罵人道具)
//          | 'shop' (店面)
//   LEVELS: every level, flat, in tree order; UPGRADES = LEVELS (old name); UPGRADE_IDS
//   BASE_TUNING: the engine tuning with nothing bought
//   applyUpgrades(owned: string[]) → tuning (BASE_TUNING with every owned level's `set` applied in tree order)
//   stationOf(levelId) → station; levelOf(owned, stationId) → owned level count (0 = base)
//   nextLevel(owned, stationId) → the next level to buy | null
//   canBuy(id, owned, wallet) → bool (unowned, affordable and the previous level of the station owned)
//   OLD_IDS: the first version's 8 ids → the closest new level (save.js migrates old saves)

export const BASE_TUNING = {
  workSlots: 3,       // prep table: cups being assembled at once
  seats: 4,           // customers at the counter
  shelf: 4,           // finished-cup shelf (出杯台) spots
  sealMs: 800,        // the sealer
  sealers: 1,         // sealers working at once
  autoSeal: false,    // a cup with tea dropped on the shelf seals itself there
  pourMs: 600,        // tea pour (the cup can still take toppings meanwhile; it cannot be sealed)
  teaAll: false,      // one tap on a tea tank fills every cup without tea
  potMax: 10,         // pearl scoops per pot
  cookMs: 8000,       // a fresh pot of pearls
  autoCook: false,    // a new pot starts by itself when the pot runs empty
  iceSmart: false,    // one tap on the ice machine gives the ordered ice level
  coconut: false,     // 椰果 on the menu
  golden: false,      // 黃金比例特調 on the menu (fixed premium recipe)
  patienceMult: 1,    // air conditioning
  tipMult: 1,         // sound system
  fameMult: 1,        // every fame gain (neon sign)
  queueBonus: 0,      // queue stanchions: more people wait outside
  helperMs: 0,        // part-timer: one cup per helperMs (0 = no helper)
  prepayMult: 1,      // 收 prepay (ticket machine)
  megaphone: false,   // 滾 sends every 奧客 at the counter flying
  // the 10.9 stations
  milkMs: 500,        // the 鮮奶 pump pour (blocks sealing like the tea pour)
  shakeMs: 900,       // the 搖杯機: one cup at a time
  autoShake: false,   // the sealer shakes the cup too (no shaking by hand)
  foamMs: 700,        // the 奶蓋機 pour
  lemonMax: 6,        // lemon slices on the tray after one round of slicing
  sliceMs: 1200,      // slicing a lemon on the board
  snackMs: 6000,      // the 雞蛋糕 iron: one batch
  snackBatch: 2,      // bags per batch
  snackCap: 3,        // ready bags kept warm at most
  autoSnack: false,   // a new batch starts by itself when the warmer is empty
};

export const STATIONS = [
  // ---- 設備 (Shawarma: meat spit, drink machine, wrapping, prep table, finished-goods shelf, fryer) ----
  { id: 'pot', tab: 'equip', levels: [
    { id: 'pot2', cost: 800, set: { potMax: 20 } },          // big pot
    { id: 'pot3', cost: 1500, set: { cookMs: 4000 } },        // double burner: cooks twice as fast
    { id: 'pot4', cost: 3200, set: { autoCook: true } },     // auto refill hopper
  ] },
  { id: 'tea', tab: 'equip', levels: [
    { id: 'tea2', cost: 900, set: { pourMs: 250 } },         // fast taps
    { id: 'tea3', cost: 2800, set: { teaAll: true } },       // manifold: one tap fills every empty cup
  ] },
  { id: 'seal', tab: 'equip', levels: [
    { id: 'seal2', cost: 1000, set: { sealMs: 350 } },        // fast sealer
    { id: 'seal3', cost: 2000, set: { sealers: 2 } },        // a second sealer
    { id: 'seal4', cost: 3800, set: { autoSeal: true } },    // sealing head over the shelf
  ] },
  { id: 'prep', tab: 'equip', levels: [
    { id: 'prep2', cost: 1300, set: { workSlots: 4 } },
    { id: 'prep3', cost: 2600, set: { workSlots: 5 } },
  ] },
  { id: 'shelf', tab: 'equip', levels: [
    { id: 'shelf2', cost: 900, set: { shelf: 5 } },
    { id: 'shelf3', cost: 1600, set: { shelf: 6 } },
  ] },
  { id: 'ice', tab: 'equip', levels: [
    { id: 'ice2', cost: 1100, set: { iceSmart: true } },      // ice dispenser: one tap = the ordered level
  ] },
  // ---- the 10.9 stations (they come with the days; their levels speed them up or automate them) ----
  { id: 'milk', tab: 'bar', levels: [
    { id: 'milk2', cost: 700, set: { milkMs: 200 } },         // fast pump
  ] },
  { id: 'shaker', tab: 'bar', levels: [
    { id: 'shaker2', cost: 900, set: { shakeMs: 400 } },      // fast shaker
    { id: 'shaker3', cost: 2400, set: { autoShake: true } },  // auto shaker: the sealer shakes the cup too
  ] },
  { id: 'foam', tab: 'bar', levels: [
    { id: 'foam2', cost: 1000, set: { foamMs: 250 } },        // fast foam
  ] },
  { id: 'lemon', tab: 'bar', levels: [
    { id: 'lemon2', cost: 800, set: { lemonMax: 12, sliceMs: 600 } }, // big board: 12 slices, slices twice as fast
  ] },
  { id: 'snack', tab: 'bar', levels: [
    { id: 'snack2', cost: 1100, set: { snackMs: 3000 } },     // double iron
    { id: 'snack3', cost: 2600, set: { autoSnack: true } },   // auto iron: a new batch when the warmer is empty
  ] },
  // ---- 菜單・員工・罵人道具 (menu expansion, staff; our curse twist) ----
  { id: 'menu', tab: 'menu', levels: [
    { id: 'menu2', cost: 1100, set: { coconut: true } },      // 椰果
    { id: 'menu3', cost: 2600, set: { golden: true } },      // 黃金比例特調
  ] },
  { id: 'staff', tab: 'menu', levels: [
    { id: 'staff1', cost: 3000, set: { helperMs: 8000 } },   // part-timer
    { id: 'staff2', cost: 4200, set: { helperMs: 5000 } },   // trained part-timer
  ] },
  { id: 'ticket', tab: 'menu', levels: [{ id: 'ticket', cost: 1400, set: { prepayMult: 2 } }] },
  { id: 'mega', tab: 'menu', levels: [{ id: 'mega', cost: 1800, set: { megaphone: true } }] },
  // ---- 店面 (decoration: patience, tips, fame, queue; the counter) ----
  { id: 'aircon', tab: 'shop', levels: [{ id: 'aircon', cost: 1600, set: { patienceMult: 1.2 } }] },
  { id: 'sound', tab: 'shop', levels: [{ id: 'sound', cost: 1200, set: { tipMult: 1.5 } }] },
  { id: 'neon', tab: 'shop', levels: [{ id: 'neon', cost: 1800, set: { fameMult: 1.5 } }] },
  { id: 'rail', tab: 'shop', levels: [{ id: 'rail', cost: 1000, set: { queueBonus: 4 } }] },
  { id: 'seat', tab: 'shop', levels: [{ id: 'seat5', cost: 2400, set: { seats: 5 } }] },
];

export const TABS = ['equip', 'bar', 'menu', 'shop'];
export const LEVELS = STATIONS.flatMap((st) => st.levels.map((l, i) => ({ ...l, station: st.id, tab: st.tab, lv: i + 2, of: st.levels.length + 1 })));
export const UPGRADES = LEVELS;
export const UPGRADE_IDS = LEVELS.map((u) => u.id);

/** The first version's flat list → the closest level of the tree (nobody loses what they bought). */
export const OLD_IDS = {
  slot3: 'prep2', fastSeal: 'seal2', bigPot: 'pot2', coconut: 'menu2', neon: 'neon', ticket: 'ticket', megaphone: 'mega', seat4: 'seat5',
};

export const stationOf = (id) => STATIONS.find((st) => st.levels.some((l) => l.id === id)) || null;
export const levelOf = (owned = [], stationId) => {
  const st = STATIONS.find((x) => x.id === stationId);
  if (!st) return 0;
  let n = 0;
  while (n < st.levels.length && owned.includes(st.levels[n].id)) n++;
  return n;
};
export function nextLevel(owned = [], stationId) {
  const st = STATIONS.find((x) => x.id === stationId);
  if (!st) return null;
  const n = levelOf(owned, stationId);
  return n < st.levels.length ? LEVELS.find((l) => l.id === st.levels[n].id) : null;
}

export function applyUpgrades(owned = []) {
  const t = { ...BASE_TUNING };
  for (const st of STATIONS) {
    const n = levelOf(owned, st.id);
    for (let i = 0; i < n; i++) Object.assign(t, st.levels[i].set);
  }
  return t;
}

export function canBuy(id, owned = [], wallet = 0) {
  const u = LEVELS.find((x) => x.id === id);
  if (!u || owned.includes(id) || wallet < u.cost) return false;
  const next = nextLevel(owned, u.station);
  return !!next && next.id === id;
}
