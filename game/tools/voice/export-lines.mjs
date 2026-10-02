// export-lines.mjs — list every line the game speaks, as synthesis jobs for build_voice.py.
// Run from game/:  node tools/voice/export-lines.mjs > /tmp/voice-jobs.json
//
// Each job: { lang, key, role, style, voice, speed, text, segments? }
//   key       clipKey(lang, line) — the same key audio.js computes at runtime
//   text      the line with stage directions, emoji and decorative symbols removed
//   segments  only for lines containing bleep words: [{type:'text'|'bleep', value}]

import { getContent } from '../../src/content.js';
import { clipKey, stripStage, splitForBleep, DEFAULT_BLEEP_WORDS } from '../../src/audio.js';

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

function speakable(line) {
  return stripStage(line)
    .replace(/\p{Extended_Pictographic}|\u{FE0F}|\u{200D}/gu, '')
    .replace(/[～~]+/g, '，')
    .replace(/[“”"「」]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[，,\s]+|[，,\s]+$/g, '')
    .trim();
}

const jobs = new Map();
function add(lang, line, role, style, voice) {
  const text = speakable(line);
  if (!text || !/[\p{L}\p{N}]/u.test(text)) return;
  const key = clipKey(lang, line);
  if (jobs.has(key)) return;
  const job = { lang, key, role, style, voice, speed: SPEED[style] ?? 1, text };
  const segs = splitForBleep(text, DEFAULT_BLEEP_WORDS);
  if (segs.some((s) => s.type === 'bleep')) job.segments = segs;
  jobs.set(key, job);
}

for (const lang of ['zh', 'en']) {
  const { customers, system } = getContent(lang);
  const cast = CAST[lang];
  for (const c of customers) {
    add(lang, c.says, 'customer', 'cust', cast.customers[c.id % cast.customers.length]);
    add(lang, c.reply, 'clerk', c.style, cast.clerk);
    add(lang, c.alt, 'clerk', c.style, cast.clerk);
  }
  system.polite.forEach((l) => add(lang, l, 'clerk', 'polite', cast.clerk));
  system.rageStart.forEach((l) => add(lang, l, 'clerk', 'rage', cast.clerk));
  system.rageLines.forEach((l) => add(lang, l, 'clerk', 'rage', cast.clerk));
  system.next.forEach((l) => add(lang, l, 'clerk', 'next', cast.clerk));
  system.closing.forEach((l) => add(lang, l, 'clerk', 'deadpan', cast.clerk));
  system.boo.forEach((l, i) => add(lang, l, 'crowd', 'boo', cast.customers[i % cast.customers.length]));
  Object.values(system.milestones).forEach((l) => add(lang, l, 'announcer', 'announce', cast.announcer));
  // 250 signature scene: clerk in the deadpan style, the customer with the first voice of the pool.
  (system.signature250 || []).forEach(({ who, text }) => {
    if (who === 'cust') add(lang, text, 'customer', 'cust', cast.customers[0]);
    else add(lang, text, 'clerk', 'deadpan', cast.clerk);
  });
}

process.stdout.write(JSON.stringify([...jobs.values()], null, 1));
