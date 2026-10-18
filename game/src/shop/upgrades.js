// upgrades.js — the 8 upgrades of gameplay v3 (docs/gameplay-v3-shop.md 6), bought between days with the wallet.
// Pure data + applyUpgrades(owned) → the engine tuning they change. No DOM.
//
//   UPGRADES: [{ id, cost, cat }]   cat: equip | menu | shop | counter (names / blurbs live in text.js)
//   applyUpgrades(owned: string[]) → { workSlots, seats, sealMs, potMax, cookMs, coconut, fameMult, prepayMult, megaphone }
//   canBuy(id, owned, wallet) → bool

export const BASE_TUNING = {
  workSlots: 2,     // cups being assembled at once
  seats: 3,         // customers at the counter
  sealMs: 800,      // the sealer
  pourMs: 600,      // tea pour animation (the cup can still take toppings meanwhile; it cannot be sealed)
  potMax: 10,       // pearl scoops per pot
  cookMs: 8000,     // a fresh pot of pearls
  coconut: false,   // 椰果 on the menu
  fameMult: 1,      // every fame gain
  prepayMult: 1,    // 收 prepay
  megaphone: false, // 滾 sends every 奧客 at the counter flying
};

export const UPGRADES = [
  { id: 'slot3', cost: 900, cat: 'equip' },     // a 3rd work slot
  { id: 'fastSeal', cost: 600, cat: 'equip' },  // sealer 0.8 s → 0.35 s
  { id: 'bigPot', cost: 500, cat: 'equip' },    // pot 10 → 20 scoops, cooks in 4.5 s
  { id: 'coconut', cost: 700, cat: 'menu' },    // 椰果 joins the menu (orders with it pay more)
  { id: 'neon', cost: 1000, cat: 'shop' },       // neon sign: fame gains ×1.5
  { id: 'ticket', cost: 800, cat: 'shop' },     // number-ticket machine: 收 prepay ×2
  { id: 'megaphone', cost: 1100, cat: 'shop' },  // megaphone: one 滾 clears every 奧客 at the counter
  { id: 'seat4', cost: 1400, cat: 'counter' },   // a 4th customer at the counter
];

export const UPGRADE_IDS = UPGRADES.map((u) => u.id);

export function applyUpgrades(owned = []) {
  const has = new Set(owned);
  const t = { ...BASE_TUNING };
  if (has.has('slot3')) t.workSlots = 3;
  if (has.has('seat4')) t.seats = 4;
  if (has.has('fastSeal')) t.sealMs = 350;
  if (has.has('bigPot')) { t.potMax = 20; t.cookMs = 4500; }
  if (has.has('coconut')) t.coconut = true;
  if (has.has('neon')) t.fameMult = 1.5;
  if (has.has('ticket')) t.prepayMult = 2;
  if (has.has('megaphone')) t.megaphone = true;
  return t;
}

export function canBuy(id, owned = [], wallet = 0) {
  const u = UPGRADES.find((x) => x.id === id);
  return !!u && !owned.includes(id) && wallet >= u.cost;
}
