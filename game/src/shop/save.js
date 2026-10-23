// save.js — gameplay v3 save in localStorage under 250cups.shop.* (every access in try/catch: private windows,
// blocked storage and previews must still play, just without a save). Pure apart from the storage object passed in.
//
//   SAVE_KEY = '250cups.shop.v1'
//   freshSave() → { v, day, wallet, fame, upgrades, best, guideDone }
//   loadSave(storage) → save (fresh when missing / broken)
//   writeSave(storage, save) → bool
//   clearSave(storage)
//   afterDay(save, summary) → the new save: wallet += earned, fame, the next day when the goal was met, bests
//   buyUpgrade(save, id) → { ok, save } (the station's previous level must be owned)
//   migrateUpgrades(list) → old ids mapped to the tree (upgrades.js OLD_IDS), unknown ids dropped
import { UPGRADES, UPGRADE_IDS, OLD_IDS, canBuy } from './upgrades.js';

export const SAVE_KEY = '250cups.shop.v1';

export function freshSave() {
  return { v: 1, day: 1, wallet: 0, fame: 0, upgrades: [], best: {}, guideDone: false };
}

/** Old ids (the first version's flat list) → their closest tree level; unknown ids dropped; no duplicates. */
export function migrateUpgrades(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const id = OLD_IDS[raw] || raw;
    if (UPGRADE_IDS.includes(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

function sane(x) {
  const f = freshSave();
  if (!x || typeof x !== 'object') return f;
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  return {
    v: 1,
    day: Math.max(1, Math.floor(num(x.day, 1))),
    wallet: Math.max(0, Math.round(num(x.wallet, 0))),
    fame: Math.max(0, Math.round(num(x.fame, 0))),
    upgrades: migrateUpgrades(x.upgrades),
    best: x.best && typeof x.best === 'object' ? { ...x.best } : {},
    guideDone: !!x.guideDone,
  };
}

export function loadSave(storage) {
  try {
    const raw = storage && storage.getItem(SAVE_KEY);
    return raw ? sane(JSON.parse(raw)) : freshSave();
  } catch {
    return freshSave();
  }
}

export function writeSave(storage, save) {
  try {
    if (!storage) return false;
    storage.setItem(SAVE_KEY, JSON.stringify(sane(save)));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage) {
  try { storage && storage.removeItem(SAVE_KEY); } catch { /* blocked */ }
}

export function afterDay(save, sum) {
  const s = sane(save);
  const earned = Math.max(0, Math.round(sum.earned || 0));
  const best = { ...s.best };
  const prev = best[sum.day] || 0;
  if (earned > prev) best[sum.day] = earned;
  return {
    ...s,
    wallet: s.wallet + earned,
    fame: Math.max(0, Math.round(sum.fame ?? s.fame)),
    day: sum.met ? Math.max(s.day, sum.day + 1) : s.day,
    best,
    guideDone: true,
  };
}

export function buyUpgrade(save, id) {
  const s = sane(save);
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || !canBuy(id, s.upgrades, s.wallet)) return { ok: false, save: s };
  return { ok: true, save: { ...s, wallet: s.wallet - u.cost, upgrades: [...s.upgrades, id] } };
}
