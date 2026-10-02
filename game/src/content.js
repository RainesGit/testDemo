// content.js — merges zh / en content.
// getContent(lang) → { customers, system }
// Customers are merged by id: English fields override Chinese ones when present;
// a missing English entry (or field) falls back to Chinese. SYSTEM falls back per field.

import { CUSTOMERS_ZH, SYSTEM_ZH } from './content.zh.js';

// content.en.js is authored separately; tolerate it being absent or incomplete.
let CUSTOMERS_EN = [];
let SYSTEM_EN = {};
try {
  const en = await import('./content.en.js');
  CUSTOMERS_EN = Array.isArray(en.CUSTOMERS_EN) ? en.CUSTOMERS_EN : [];
  SYSTEM_EN = en.SYSTEM_EN && typeof en.SYSTEM_EN === 'object' ? en.SYSTEM_EN : {};
} catch (err) {
  console.warn('[content] content.en.js unavailable, falling back to zh:', err && err.message);
}

const isEmpty = (v) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

// Shallow-merge plain objects one level deep (for ui / milestones); arrays and strings replace.
function mergeSystem(base, over) {
  const out = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(over || {})])) {
    const b = base[k];
    const o = over ? over[k] : undefined;
    if (isEmpty(o)) out[k] = b;
    else if (b && o && typeof b === 'object' && typeof o === 'object' && !Array.isArray(b) && !Array.isArray(o)) {
      out[k] = mergeSystem(b, o);
    } else out[k] = o;
  }
  return out;
}

function mergeCustomers(base, over) {
  const byId = new Map(over.map((c) => [c.id, c]));
  return base.map((zh) => {
    const en = byId.get(zh.id);
    if (!en) return { ...zh };
    const merged = { ...zh };
    for (const [k, v] of Object.entries(en)) {
      if (k === 'id') continue;
      if (k === 'cups' ? v !== undefined : !isEmpty(v)) merged[k] = v;
    }
    return merged;
  });
}

const cache = {};

export function getContent(lang = 'zh') {
  const key = lang === 'en' ? 'en' : 'zh';
  if (!cache[key]) {
    cache[key] =
      key === 'en'
        ? { customers: mergeCustomers(CUSTOMERS_ZH, CUSTOMERS_EN), system: mergeSystem(SYSTEM_ZH, SYSTEM_EN) }
        : { customers: CUSTOMERS_ZH.map((c) => ({ ...c })), system: mergeSystem(SYSTEM_ZH, {}) };
  }
  return cache[key];
}

export { CUSTOMERS_ZH, SYSTEM_ZH };
