// oke.js — the 奧客 roster of gameplay v3 (docs/gameplay-v3-shop.md 4.2): 8 types for days 1–5, each one of the 100
// customers of src/content.*.js (their look, what they say, and the clerk's curse lines all come from there, so the
// AI voice pack already has every line). Pure: no DOM.
//
//   OKE: [{ type, cid, day, best, prop, prepay, cutsIn? }]
//     cid    content customer id (src/content.zh.js)
//     day    first day it can show up
//     best   the funniest answer ('gun' 滾 | 'shut' 閉嘴 | 'take' 收): bigger fame + laugh. Every answer works.
//     prop   the request prop drawn in its bubble (art-shop.js okeBubbleSVG)
//     prepay money a 收 brings in (before the ticket machine)
//   OKE_CIDS: Set of the content ids above (normal customers never borrow these faces)
//   okeOf(type) → entry | null
//   okePool(day) → the types unlocked by that day
//   okeLine(type, key, content) → the clerk's line ('|' cut point kept for audio.playClerk)
//   normalLine(cid, content) → the clerk's line when a normal customer is cursed (that customer's own reply)
//   customerSays(cid, content) → what the customer says (display text, '|' removed)

export const OKE = [
  { type: 'one', cid: 41, day: 1, best: 'gun', prop: 'one', prepay: 40 },        // 一杯就好
  { type: 'c250', cid: 47, day: 1, best: 'take', prop: 'c250', prepay: 250 },    // 250 杯客
  { type: 'taste', cid: 34, day: 2, best: 'gun', prop: 'taste', prepay: 40 },    // 試喝客
  { type: 'lessIce', cid: 12, day: 2, best: 'shut', prop: 'lessIce', prepay: 40 }, // 少冰黨
  { type: 'cutIn', cid: 90, day: 3, best: 'gun', prop: 'cutIn', prepay: 40, cutsIn: true }, // 插隊客
  { type: 'bucket', cid: 33, day: 3, best: 'gun', prop: 'bucket', prepay: 80 },  // 自備水桶
  { type: 'phone', cid: 60, day: 4, best: 'gun', prop: 'phone', prepay: 40 },    // 講電話客
  { type: 'live', cid: 73, day: 5, best: 'shut', prop: 'live', prepay: 60 },     // 網紅直播
];

export const OKE_CIDS = new Set(OKE.map((o) => o.cid));

export function okeOf(type) {
  return OKE.find((o) => o.type === type) || null;
}

export function okePool(day) {
  return OKE.filter((o) => o.day <= day).map((o) => o.type);
}

const custOf = (cid, content) => (content && content.customers ? content.customers.find((c) => c.id === cid) : null) || null;

/** The clerk's line for answer `key` to a 奧客 of `type`: the best answer gets the customer's own reply, the others
 *  its alt line; the 250-cup customer gets the opening's signature lines. */
export function okeLine(type, key, content) {
  const o = okeOf(type);
  if (!o) return '';
  const sys = (content && content.system) || {};
  if (type === 'c250') {
    const op = sys.opening || {};
    if (key === 'take' && op.r4d && op.r4e) return `${op.r4d}|${op.r4e}`;
    if (key === 'shut' && sys.originalCustomer && sys.originalCustomer.reply2) return sys.originalCustomer.reply2;
    if (key === 'gun' && Array.isArray(sys.rageLines) && sys.rageLines[25]) return sys.rageLines[25]; // 二百五！
  }
  const c = custOf(o.cid, content);
  if (!c) return '';
  return key === o.best ? c.reply : c.alt || c.reply;
}

export function normalLine(cid, content) {
  const c = custOf(cid, content);
  return c ? c.reply : '';
}

export function customerSays(cid, content) {
  const c = custOf(cid, content);
  return c ? String(c.says || '').replace(/\|/g, '') : '';
}
