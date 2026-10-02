// check-content.mjs — automated design-rule and content checks for acceptance (see docs/acceptance-checklist.md).
// Run from game/:  node tools/check-content.mjs
// Prints one PASS/FAIL line per check and exits 1 if any check fails.

import { readFileSync } from 'node:fs';
import { CUSTOMERS_ZH, SYSTEM_ZH } from '../src/content.zh.js';
import { CUSTOMERS_EN, SYSTEM_EN } from '../src/content.en.js';
import { createGame, DEFAULT_CONFIG } from '../src/engine.js';

const STYLES = new Set(['real', 'curse', 'disdain', 'cold', 'deadpan', 'chuuni', 'math', '250', 'twist']);
const KEYS = new Set(['gun', 'shut', 'take']);
const results = [];
const check = (id, name, ok, detail = '') => results.push({ id, name, ok: !!ok, detail });

// All player-facing text in one language.
function texts(customers, system) {
  const out = [];
  for (const c of customers) out.push(c.name, c.says, c.reply, c.alt);
  for (const v of Object.values(system)) {
    if (Array.isArray(v)) v.forEach((x) => out.push(typeof x === 'string' ? x : x.text));
    else if (v && typeof v === 'object') out.push(...Object.values(v));
  }
  return out.filter(Boolean).map(String);
}
const ZH = texts(CUSTOMERS_ZH, SYSTEM_ZH);
const EN = texts(CUSTOMERS_EN, SYSTEM_EN);
const hits = (list, re) => list.filter((t) => re.test(t));

// B. Content completeness
for (const [lang, list] of [['zh', CUSTOMERS_ZH], ['en', CUSTOMERS_EN]]) {
  const ids = list.map((c) => c.id).sort((a, b) => a - b);
  check(`B1-${lang}`, `${lang}: exactly 100 customers with ids 1..100`,
    list.length === 100 && ids.every((id, i) => id === i + 1), `count=${list.length}`);
  const bad = list.filter((c) => !c.name || !c.says || !c.reply || !c.alt || !STYLES.has(c.style) || !KEYS.has(c.key));
  check(`B2-${lang}`, `${lang}: every customer has name/says/reply/alt and a valid style and key`,
    bad.length === 0, bad.map((c) => c.id).join(','));
}
const enById = new Map(CUSTOMERS_EN.map((c) => [c.id, c]));
const mismatch = CUSTOMERS_ZH.filter((z) => {
  const e = enById.get(z.id);
  return !e || e.style !== z.style || e.key !== z.key || (e.cups ?? null) !== (z.cups ?? null);
});
check('B3', 'zh and en share style, key and cups for every id', mismatch.length === 0, mismatch.map((c) => c.id).join(','));
for (const [lang, sys] of [['zh', SYSTEM_ZH], ['en', SYSTEM_EN]]) {
  const ok = sys.next?.length >= 5 && sys.polite?.length >= 4 && sys.boo?.length >= 3 && sys.rageStart?.length >= 2
    && sys.rageLines?.length >= 24 && sys.closing?.length >= 3 && sys.signature250?.length >= 6
    && [10, 100, 1000, 10000, 100000].every((k) => sys.milestones?.[k])
    && ['gun', 'shut', 'take', 'queue', 'aura', 'fury', 'start', 'again', 'bleep'].every((k) => sys.ui?.[k]);
  check(`B4-${lang}`, `${lang}: system lines complete (next>=5, polite>=4, rageLines>=24, milestones, ui, signature250)`, ok);
}

// C. Design red lines (shipped game text only; docs are reviewed by hand)
const delivery = [...hits(ZH, /外送|外卖|送餐|骑手|熊猫外送|Uber ?Eats|foodpanda/i), ...hits(EN, /deliver(y|ies)|DoorDash|Uber ?Eats|Grubhub|courier|rider|delivery ?guy/i)];
check('C1', 'no delivery-rider characters or references', delivery.length === 0, delivery.slice(0, 3).join(' | '));
const fantasy = [...hits(ZH, /羊驼|草泥马|外星|太空|魔法|巫师|龙族|恶魔/), ...hits(EN, /alpaca|llama|alien|outer space|magic|wizard|dragon|demon/i)];
check('C2', 'no fantasy elements (alpaca, aliens, space, magic)', fantasy.length === 0, fantasy.slice(0, 3).join(' | '));
const curse = CUSTOMERS_ZH.filter((c) => c.style === 'curse').length;
check('C3', 'explicit-curse style is a heavy hitter, about 10% of customers (8-14)', curse >= 8 && curse <= 14, `curse=${curse}`);
const has250 = CUSTOMERS_ZH.some((c) => c.cups === 250) && CUSTOMERS_ZH.filter((c) => c.style === '250').length >= 5;
check('C4', '250 is present as a signature (a 250-cup customer and >=5 "250" style lines)', has250);
const sig = ZH.join('\n');
check('C5', 'signature lines present: 黄金比例最好喝, 两个月, 下一位', /黄金比例最好喝/.test(sig) && /两个月/.test(sig) && /下一位/.test(sig));

// Only failure is being slow: wrong presses must not cost aura in the shipped config.
const mainSrc = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const mainOverride = /auraWrong:\s*(-?[\d.]+)/.exec(mainSrc);
check('C6', 'engine default auraWrong is 0 and main.js does not override it with a penalty',
  DEFAULT_CONFIG.auraWrong === 0 && (!mainOverride || Number(mainOverride[1]) >= 0),
  `default=${DEFAULT_CONFIG.auraWrong}${mainOverride ? `, main.js=${mainOverride[1]}` : ''}`);
{
  const customers = [{ id: 1, style: 'real', key: 'gun', reply: 'r', alt: 'a' }, { id: 2, style: 'cold', key: 'shut', reply: 'r', alt: 'a' }];
  const g = createGame({ customers, rng: () => 0.5 });
  g.start();
  const before = g.state.aura;
  const cur = g.state.current.customer;
  g.press(cur.key === 'gun' ? 'shut' : 'gun', 0);
  check('C7', 'with the default config a wrong press leaves aura unchanged and still grows the queue',
    g.state.aura === before && g.state.queue >= 1, `aura ${before} -> ${g.state.aura}, queue=${g.state.queue}`);
}

// Report
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id} ${r.name}${r.detail ? `  [${r.detail}]` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
