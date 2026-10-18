// save.js — gameplay v3 save in localStorage under 250cups.shop.* (every access in try/catch: private windows,
// blocked storage and previews must still play, just without a save). Pure apart from the storage object passed in.
//
//   SAVE_KEY = '250cups.shop.v1'
//   freshSave() → { v, day, wallet, fame, upgrades, best, guideDone }
//   loadSave(storage) → save (fresh when missing / broken)
//   writeSave(storage, save) → bool
//   clearSave(storage)
//   afterDay(save, summary) → the new save: wallet += earned, fame, the next day when the goal was met, bests
//   buyUpgrade(save, id) → { ok, save }
import { UPGRADES, UPGRADE_IDS } from './upgrades.js';

export const SAVE_KEY = '250cups.shop.v1';

export function freshSave() {
  return { v: 1, day: 1, wallet: 0, fame: 0, upgrades: [], best: {}, guideDone: false };
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
    upgrades: Array.isArray(x.upgrades) ? x.upgrades.filter((id) => UPGRADE_IDS.includes(id)) : [],
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
  if (!u || s.upgrades.includes(id) || s.wallet < u.cost) return { ok: false, save: s };
  return { ok: true, save: { ...s, wallet: s.wallet - u.cost, upgrades: [...s.upgrades, id] } };
}
