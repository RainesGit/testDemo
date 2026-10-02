// export-lines.mjs — list every line the game speaks, as synthesis jobs for build_voice.py.
// Run from game/:  node tools/voice/export-lines.mjs > /tmp/voice-jobs.json
//
// Each job: { lang, key, role, style, voice, speed, text, part?, segments? }
//   key       clipKey(lang, line) — the same key audio.js computes at runtime (from the DISPLAYED text)
//   text      what the TTS reads: stage directions, emoji and decorative symbols removed, and numbers
//             rewritten by audio.ttsText (zh "250杯" → "二百五十杯", en "250" → "two-fifty"; spec K1)
//   part      'setup' | 'punch' for lines with a '|' cut point (spec 3.1, 8.7): such a line is exported as
//             two jobs, keyed by clipKey(lang, half), the setup at speed 1.10 and the punch at 0.90; the
//             whole line is not exported
//   segments  only for lines containing bleep words: [{type:'text'|'bleep', value}]
//
// Order matters when two lines share a key (same text): the first job wins, so the opening routine is
// exported first, then customers, then system lines.

import { getContent } from '../../src/content.js';
import { clipKey, stripStage, splitForBleep, splitPunch, ttsText, DEFAULT_BLEEP_WORDS } from '../../src/audio.js';

// Voice casting (Kokoro v1.0 voices, Apache-2.0). Customers rotate through their pool by id.
const CAST = {
  zh: {
    clerk: 'zm_yunjian',
    announcer: 'zf_xiaoxiao',
    customers: ['zf_xiaobei', 'zm_yunxi', 'zf_xiaoni', 'zm_yunyang', 'zf_xiaoyi', 'zm_yunxia'],
  },
  en: {
    clerk: 'am_fenrir',
    announcer: 'af_nova',
    customers: ['af_heart', 'am_puck', 'af_bella', 'am_echo', 'bf_emma', 'am_adam', 'af_sarah', 'bm_george'],
  },
};

// Speaking speed per delivery style (1 = normal).
const SPEED = {
  real: 1.1, curse: 1.2, disdain: 1.0, cold: 0.88, deadpan: 1.0, chuuni: 0.95, math: 1.15,
  '250': 1.05, twist: 1.05, polite: 0.92, rage: 1.3, cust: 1.1, next: 1.15, boo: 1.2, announce: 1.1,
};
// Cut-point halves (spec 8.6 item 7): quick setup, heavy punch.
const PART_SPEED = { setup: 1.10, punch: 0.90 };

// Opening routine voices: customer 1 / 2 / 3 (customer 3 keeps one voice for all three of its lines).
const OPENING_CUST = {
  zh: { c1: 'zm_yunxi', c2: 'zm_yunyang', c3: 'zf_xiaoni', c3b: 'zf_xiaoni', c3c: 'zf_xiaoni' },
  en: { c1: 'am_puck', c2: 'am_echo', c3: 'af_bella', c3b: 'af_bella', c3c: 'af_bella' },
};
// Opening clerk lines: delivery style per key (wrong.* and timeout.* handled below).
const OPENING_STYLE = {
  ask: 'deadpan', r3: 'cold', r3b: 'deadpan', r4: 'curse', r4b: 'chuuni', r4c: 'deadpan', r4d: 'deadpan',
  r4e: 'deadpan', r4f: 'deadpan', next: 'next',
};
// Display-only parts of SYSTEM.opening (spec 8.7 item 1).
const OPENING_SILENT = new Set(['dayCard', 'signs', 'cue', 'hz', 'recap', 'plate', 'closing']);

function speakable(line, lang) {
  return stripStage(ttsText(line, lang))
    .replace(/\p{Extended_Pictographic}|\u{FE0F}|\u{200D}/gu, '')
    .replace(/[～~]+/g, '，')
    .replace(/[“”"「」]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[，,\s]+|[，,\s]+$/g, '')
    .trim();
}

const jobs = new Map();
function addOne(lang, line, role, style, voice, speed, part) {
  const text = speakable(line, lang);
  if (!text || !/[\p{L}\p{N}]/u.test(text)) return;
  const key = clipKey(lang, line);
  if (jobs.has(key)) return;
  const job = { lang, key, role, style, voice, speed, text };
  if (part) job.part = part;
  const segs = splitForBleep(text, DEFAULT_BLEEP_WORDS);
  if (segs.some((x) => x.type === 'bleep')) job.segments = segs;
  jobs.set(key, job);
}
function add(lang, line, role, style, voice) {
  if (line == null) return;
  if (String(line).includes('|')) {
    const [setup, punch] = splitPunch(line);
    addOne(lang, setup, role, style, voice, PART_SPEED.setup, 'setup');
    addOne(lang, punch, role, style, voice, PART_SPEED.punch, 'punch');
    return;
  }
  addOne(lang, line, role, style, voice, SPEED[style] ?? 1);
}

/** Every spoken line of SYSTEM.opening as [line, role, style, voiceKey]. Exported for check-content. */
export function openingLines(opening = {}) {
  const out = [];
  for (const [k, v] of Object.entries(opening)) {
    if (OPENING_SILENT.has(k)) continue;
    if (typeof v === 'string') {
      if (/^c\d/.test(k)) out.push([v, 'customer', 'cust', k]);
      else out.push([v, 'clerk', OPENING_STYLE[k] || 'deadpan', null]);
    } else if (k === 'wrong' && v) {
      for (const [wk, wv] of Object.entries(v)) out.push([wv, 'clerk', /^w\d(gun|shut)$/.test(wk) && wk.startsWith('w3') ? 'curse' : 'real', null]);
    } else if (k === 'timeout' && v) {
      for (const [tk, tv] of Object.entries(v)) {
        for (const line of Array.isArray(tv) ? tv : [tv]) out.push([line, 'clerk', /^notMe/.test(tk) ? 'cold' : 'polite', null]);
      }
    }
  }
  return out;
}

function exportAll() {
  for (const lang of ['zh', 'en']) {
    const { customers, system } = getContent(lang);
    const cast = CAST[lang];
    // Day 1 opening routine first (spec 8.7 item 1), so its voices win shared keys.
    for (const [line, role, style, who] of openingLines(system.opening)) {
      const voice = role === 'customer' ? OPENING_CUST[lang][who] || cast.customers[0] : cast.clerk;
      // "调你妈！" has no setup half but is the routine's biggest punch: punch speed.
      if (line === system.opening.r4) addOne(lang, line, role, style, voice, PART_SPEED.punch, 'punch');
      else add(lang, line, role, style, voice);
    }
    for (const c of customers) {
      add(lang, c.says, 'customer', 'cust', cast.customers[c.id % cast.customers.length]);
      add(lang, c.reply, 'clerk', c.style, cast.clerk);
      add(lang, c.alt, 'clerk', c.style, cast.clerk);
    }
    // Day 3+ two-step "original" customer: same voices as opening customer 3 and the clerk.
    const oc = system.originalCustomer;
    if (oc) {
      add(lang, oc.says, 'customer', 'cust', OPENING_CUST[lang].c3);
      add(lang, oc.says2, 'customer', 'cust', OPENING_CUST[lang].c3);
      add(lang, oc.reply1, 'clerk', 'cold', cast.clerk);
      add(lang, oc.reply2, 'clerk', 'curse', cast.clerk);
    }
    system.polite.forEach((l) => add(lang, l, 'clerk', 'polite', cast.clerk));
    system.rageStart.forEach((l) => add(lang, l, 'clerk', 'rage', cast.clerk));
    system.rageLines.forEach((l) => add(lang, l, 'clerk', 'rage', cast.clerk));
    system.next.forEach((l) => add(lang, l, 'clerk', 'next', cast.clerk));
    system.closing.forEach((l) => add(lang, l, 'clerk', 'deadpan', cast.clerk));
    system.boo.forEach((l, i) => add(lang, l, 'crowd', 'boo', cast.customers[i % cast.customers.length]));
    Object.values(system.milestones).forEach((l) => add(lang, l, 'announcer', 'announce', cast.announcer));
  }
  return [...jobs.values()];
}

/** All synthesis jobs (also used by tests and check-content). */
export function exportJobs() {
  jobs.clear();
  return exportAll();
}

// CLI: print the jobs when run directly (node tools/voice/export-lines.mjs > jobs.json).
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.stdout.write(JSON.stringify(exportJobs(), null, 1));
}
