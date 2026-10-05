// 《来250杯！》/ "250 Cups!" — audio module.
// All SFX are synthesized with WebAudio (no external audio files, zero copyright risk).
// Speech uses the Web Speech API (speechSynthesis). Everything degrades silently when
// the browser lacks support. Nothing makes sound until unlock() runs inside a user gesture.
//
// Pure helpers (stripStage, splitForBleep, styleParams, chuuniSplit, buildSpeechPlan, splitPunch,
// ttsText, zhNumber, enNumber, estimateSpeechMs, voicePlan, timingsFromManifest) have no DOM/audio dependency
// and are unit-tested in test/audio.test.mjs.
//
// createAudio() → audio. First-minute additions (docs/first-minute-spec.md 8.5):
//   playClerk(text, { punchGapMs = 200, punchFx = 'normal'|'curse'|'mega', bedBackMs = 200, style, punchOnly })
//       → Promise & { setupMs, gapMs, punchStartMs, punchMs, totalMs }   ('|' = setup | punch cut point)
//       punchOnly (gameplay-v2 fast mouth): only the punch half plays (punchOnlyText); voiceTimings takes it too
//   playCustomer(text, { rate = 1 }) → Promise & { ms }
//   voiceTimings(text, { punchGapMs, punchFx, rate, lang }) → same timing object, sync (manifest or estimate)
//   cut(ms = 40)              fade all voices out (W3 brake, interrupted customer)
//   hush(ms = 20)             voices + loops + bed to silence (E1)
//   duck(toDb = -60, ms = 30) / restore(ms = 200, delayMs = 0)   bed level
//   bed(on = true, level)     crowd murmur + 110 BPM rhythm (-18 dB)
//   loop(name, opts) → { stop(ms), detune(cents) }   'musicbox' | 'hum';  stopLoop(name, ms), stopLoops(ms)
//   sfx(name, opts)           + gate slam boom whoosh press pop card tick tap ding coin bell dingdong stamp slap clock
//                               sigh scratch feedback sparkle drumroll crowdOh huh (all synthesized)
//   setVoiceFx(on | tuning) / voiceFx, setLite(on)   runtime voice punch (VOICE_FX, voicePlan); createAudio({ voiceFx })

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

// Default words that get replaced with a bleep when bleep mode is on.
// Strings match literally (ASCII words case-insensitively, on word boundaries);
// RegExp entries are used as-is (lets us avoid bleeping 干杯 / 饼干 etc.).
export const DEFAULT_BLEEP_WORDS = [
  '你妈的', '你媽的', '你妈', '你媽', '他妈的', '他媽的', '他妈', '他媽', '妈的', '媽的',
  '靠北', '靠杯', '靠腰', '干你', '幹你', '机掰', '機掰', '王八蛋', 'TMD',
  /(?<![饼餅能不才若苦精])[干幹](?![杯嘛麼么净淨脆吗嗎啥活掉部燥扰擾涉預预事])/,
  'your mom', 'yo mama', 'motherfucker', 'fucking', 'fuck', 'shit', 'damn', 'hell', 'bitch', 'ass',
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function wordToSource(w) {
  if (w instanceof RegExp) return w.source;
  const s = String(w);
  const esc = escapeRe(s);
  // ASCII words get word boundaries so "hello" doesn't bleep "hell".
  const pre = /^[A-Za-z0-9]/.test(s) ? '\\b' : '';
  const post = /[A-Za-z0-9]$/.test(s) ? '\\b' : '';
  return pre + esc + post;
}

/** Remove stage directions in full-width （…） or half-width (…) parentheses. */
export function stripStage(text) {
  return String(text ?? '')
    .replace(/（[^（）]*）/g, ' ')
    .replace(/\([^()]*\)/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Stable id for a pre-rendered voice clip: FNV-1a (32-bit, hex) of "lang|line without stage directions".
 * tools/voice/export-lines.mjs uses the same function, so build time and runtime agree.
 */
export function clipKey(lang, text) {
  const s = `${lang === 'en' ? 'en' : 'zh'}|${stripStage(text)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Split a clerk line at its '|' cut point (spec 3.1 / 8.5): [setup, punch].
 * Without '|' the whole line is the punch and setup is ''. Stage directions stay in place;
 * clipKey() strips them, so each half has its own clip key.
 */
export function splitPunch(text) {
  const s = String(text ?? '');
  const i = s.indexOf('|');
  if (i < 0) return ['', s];
  return [s.slice(0, i), s.slice(i + 1).replace(/\|/g, '')];
}

/** Fast mouth: the punch half of a cut line (a line without '|' is all punch already). */
export function punchOnlyText(text) {
  return splitPunch(text)[1];
}

/** Display text: the '|' cut point removed. */
export const unpipe = (text) => String(text ?? '').replace(/\|/g, '');

// ---- numbers for TTS (spec 8.7 / K1: Kokoro reads "250杯" badly; feed it 二百五十) ----
const ZH_DIGIT = '零一二三四五六七八九';
function zhUnder10k(n, lead) {
  const units = [[1000, '千'], [100, '百'], [10, '十'], [1, '']];
  let out = '';
  let zero = false;
  for (const [u, name] of units) {
    const d = Math.floor(n / u) % 10;
    if (d === 0) { if (out) zero = true; continue; }
    if (zero) { out += '零'; zero = false; }
    // 2 before 千 reads 两; 二百 stays 二 (the signature number is 二百五十)
    const digit = d === 2 && u === 1000 ? '两' : ZH_DIGIT[d];
    out += (u === 10 && d === 1 && !out && lead) ? name : digit + name;
  }
  return out;
}
/** Integer → Mandarin reading: 250 → 二百五十, 15 → 十五, 10000 → 一万. */
export function zhNumber(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return '零';
  if (n >= 1e8) return String(n).split('').map((d) => ZH_DIGIT[d]).join('');
  const hi = Math.floor(n / 10000);
  const lo = n % 10000;
  let out = hi ? zhUnder10k(hi, true) + '万' : '';
  if (lo) out += (hi && lo < 1000 ? '零' : '') + zhUnder10k(lo, !hi);
  return out;
}

const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function enUnder100(n) {
  if (n < 20) return EN_ONES[n];
  return EN_TENS[Math.floor(n / 10)] + (n % 10 ? '-' + EN_ONES[n % 10] : '');
}
/**
 * Integer → the way the English clerk says it (voice-bible 5.4/6.1): 250 → "two-fifty",
 * 251 → "two-fifty-one", 520 → "five-twenty", 100 → "a hundred", 15 → "fifteen".
 */
export function enNumber(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n < 100) return enUnder100(n);
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    if (!r) return h === 1 ? 'a hundred' : `${EN_ONES[h]} hundred`;
    return `${EN_ONES[h]}-${r < 10 ? 'oh-' + EN_ONES[r] : enUnder100(r)}`;
  }
  if (n < 1e6) {
    const k = Math.floor(n / 1000);
    const r = n % 1000;
    return `${k === 1 ? 'a' : enNumber(k)} thousand${r ? ' ' + enNumber(r) : ''}`;
  }
  return String(n).split('').map((d) => EN_ONES[d]).join(' ');
}

/**
 * Text sent to TTS (voice pack builder and the Web Speech fallback). Only the spoken text changes;
 * clip keys are still computed from the displayed line. zh: Arabic numbers → Chinese numerals
 * (250杯 → 二百五十杯, 37% → 百分之三十七, Taipei 101 → 一零一); en: digits → words ("250" → "two-fifty").
 */
export function ttsText(text, lang = 'zh') {
  const s = unpipe(text);
  if (lang === 'en') {
    return s
      .replace(/(\d+)%/g, (_, d) => `${enNumber(d)} percent`)
      .replace(/No\.\s*(\d+)/gi, (_, d) => `number ${String(d).split('').map((x) => (x === '0' ? 'oh' : EN_ONES[x])).join(' ')}`)
      .replace(/\d+/g, (d) => enNumber(d));
  }
  return s
    .replace(/(\d+)%/g, (_, d) => `百分之${zhNumber(d)}`)
    .replace(/\d+/g, (d, i, all) => (d === '101' && all[i + d.length] !== '杯' ? '一零一' : zhNumber(d)));
}

/**
 * Speech length estimate when a line has no clip. The spec's placeholder (180 + 95 ms per character)
 * is replaced by a fit to the shipped Kokoro pack (258 zh / 257 en clips, least squares):
 * zh 60 + 190 ms per character, en 90 + 270 ms per word (letters are far shorter than hanzi).
 */
export function estimateSpeechMs(text, lang = 'zh') {
  const s = stripStage(ttsText(text, lang));
  if (!/[\p{L}\p{N}]/u.test(s)) return 0;
  if (lang === 'en') {
    const words = s.split(/[\s—-]+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    return Math.round(90 + 270 * words);
  }
  const chars = [...s].filter((c) => /[\p{L}\p{N}]/u.test(c)).length;
  return Math.round(60 + 190 * chars);
}

export const PUNCH_RATE = { normal: 1, curse: 1, mega: 0.94 };
/** playbackRate of whole clips per delivery style (forced-polite voice a little higher and faster, etc.). */
export const CLIP_RATE = { polite: 1.08, cold: 0.97, rage: 1.04 };

export const dbToGain = (db) => Math.pow(10, db / 20);

/**
 * Runtime "voice punch" (Kokoro has no emotion control, so the hit is made in the mix). When enabled, the
 * hit half of a clerk line (normally the part after '|'; the half with the curse word when the curse comes
 * first, as in "调你妈！|黄金比例最好喝！"), rage lines and the 调你妈 climax go through:
 *   [megaphone blend, rage only] → WaveShaper (gentle; curse/mega/rage: the spec 8.5 k = 8 curve)
 *   → +driveDb → DynamicsCompressor (fast attack) → +makeupDb   (mega adds the spec's 70 ms / 25 % echo)
 * played at playbackRate punchRate (mega keeps PUNCH_RATE.mega, the slow-motion climax), with a synthesized
 * impact (low thump + slap) at the exact onset. A line without a setup gets breathMs of silence before the
 * hit. The polite setup half stays clean and setupDb softer. Durations reported by timingsFromManifest()
 * include every rate change and the breath. Lite mode keeps rate, level, impact and breath (so timing does
 * not depend on it) but drops the compressor, shaper and megaphone filters. enabled: false (or ?punchfx=0)
 * restores the plain spec 8.5 chain.
 */
export const VOICE_FX = {
  enabled: true,
  punchRate: 1.06,   // playbackRate of the hit (about +1 semitone; mega keeps 0.94)
  driveDb: 5,        // into the compressor; +1 dB more when hot (curse / mega / rage)
  liteDriveDb: 3,    // lite mode has no compressor: less drive
  makeupDb: 3,
  setupDb: -1.5,     // polite setup half, clean and slightly softer
  breathMs: 60,      // silence before a hit that has no setup (rage lines, 调你妈)
  gentleK: 1.8,      // tanh saturation amount for ordinary punch halves
  impact: true,      // synthesized thump + slap at the onset of the hit
  impactGain: 0.7,   // 1.0 for mega
  megaphone: true,   // subtle band-passed blend during rage
  compressor: { threshold: -20, knee: 4, ratio: 5, attack: 0.001, release: 0.09 },
};

const HOT_STYLES = new Set(['rage', 'curse']);
/** True when the text contains a default bleep word (used to find which half of a line is the curse). */
export const hasCurse = (text) => splitForBleep(stripStage(text), DEFAULT_BLEEP_WORDS).some((s) => s.type === 'bleep');

function fxConfig(voiceFx) {
  if (!voiceFx) return null;
  const cfg = voiceFx === true ? VOICE_FX : { ...VOICE_FX, ...voiceFx };
  return cfg.enabled === false ? null : cfg;
}

/**
 * How each half of a line is played (pure). Returns { hit: 'setup'|'punch'|null, breathMs, setup, punch };
 * setup is null when the line has no setup half. Each half: { rate, gainDb, chain: null|'legacy'|'punch', fx,
 * driveDb, makeupDb, saturation: 0|k|'hot', compress, megaphone, echo, impact, impactGain }.
 *   via: 'clerk' (playClerk; the legacy chain always runs on the punch) | 'speak' (speak() of a whole line).
 *   voiceFx: false = legacy (spec 8.5 chain only), true = VOICE_FX, or an object merged over VOICE_FX.
 */
export function voicePlan(text, { fx = 'normal', style, voiceFx = false, lite = false, via = 'clerk' } = {}) {
  const [setup, punch] = splitPunch(text);
  const hasSetup = !!stripStage(setup);
  const base = CLIP_RATE[style] || 1;
  const clean = (gainDb = 0) => ({ rate: base, gainDb, chain: null });
  const legacyPunch = via === 'clerk'
    ? { rate: fx === 'mega' ? PUNCH_RATE.mega : base, gainDb: 0, chain: 'legacy', fx }
    : clean();
  const cfg = fxConfig(voiceFx);
  if (!cfg || style === 'polite') {
    return { hit: null, breathMs: 0, setup: hasSetup ? clean() : null, punch: legacyPunch };
  }
  let hit = null;
  if (hasSetup) hit = hasCurse(setup) && !hasCurse(punch) ? 'setup' : 'punch';
  else if (fx === 'mega' || fx === 'curse' || HOT_STYLES.has(style)) hit = 'punch';
  if (!hit) return { hit: null, breathMs: 0, setup: null, punch: legacyPunch };
  const hot = fx === 'curse' || fx === 'mega' || HOT_STYLES.has(style);
  const impact = !!cfg.impact && (hasSetup || fx === 'mega' || style === 'rage');
  const hitPlan = {
    rate: fx === 'mega' ? PUNCH_RATE.mega : Math.max(base, cfg.punchRate),
    gainDb: 0,
    chain: 'punch',
    fx,
    driveDb: lite ? cfg.liteDriveDb : cfg.driveDb + (hot ? 1 : 0),
    makeupDb: lite ? 0 : cfg.makeupDb,
    saturation: lite ? 0 : hot ? 'hot' : cfg.gentleK,
    compress: !lite,
    megaphone: !lite && !!cfg.megaphone && style === 'rage',
    echo: fx === 'mega',
    impact,
    impactGain: fx === 'mega' ? 1 : cfg.impactGain,
  };
  if (!hasSetup) return { hit, breathMs: impact ? cfg.breathMs : 0, setup: null, punch: hitPlan };
  return hit === 'punch'
    ? { hit, breathMs: 0, setup: clean(cfg.setupDb), punch: hitPlan }
    : { hit, breathMs: 0, setup: hitPlan, punch: clean() }; // curse first: the professional half stays clean
}

/**
 * Timing of a line from a voice-pack manifest (pure; audio.voiceTimings() wraps it with the loaded pack).
 * Returns { setupMs, gapMs, punchStartMs, punchMs, totalMs, clips: { setup, punch } } in ms.
 * Lines without '|' are all punch (setupMs 0, no gap; with the voice punch on, a hit without a setup starts
 * after VOICE_FX.breathMs, reported as gapMs). Every playbackRate change from voicePlan() (style, mega,
 * punchRate) is applied, so the numbers match what plays. Missing clips fall back to estimateSpeechMs().
 */
export function timingsFromManifest(manifest, lang, text, {
  punchGapMs = 200, punchFx = 'normal', rate = 1, bleep = false, style, voiceFx = false, lite = false,
} = {}) {
  const l = lang === 'en' ? 'en' : 'zh';
  const clips = manifest?.langs?.[l]?.clips || {};
  const [setup, punch] = splitPunch(text);
  const plan = voicePlan(text, { fx: punchFx, style, voiceFx, lite });
  const len = (part, r) => {
    if (!stripStage(part)) return { ms: 0, clip: false };
    const c0 = clips[clipKey(l, part)];
    const c = c0 && bleep && c0.b ? c0.b : c0;
    if (c) return { ms: Math.round((c.d * 1000) / r), clip: true };
    return { ms: Math.round(estimateSpeechMs(part, l) / r), clip: false };
  };
  const s = len(setup, rate * (plan.setup?.rate || 1));
  const p = len(punch, rate * plan.punch.rate);
  const gapMs = s.ms > 0 && p.ms > 0 ? punchGapMs : (s.ms === 0 && p.ms > 0 ? plan.breathMs : 0);
  const punchStartMs = s.ms + gapMs;
  return {
    setupMs: s.ms, gapMs, punchStartMs, punchMs: p.ms, totalMs: punchStartMs + p.ms,
    clips: { setup: s.clip, punch: p.clip },
  };
}

/**
 * Split text into spoken text and bleep segments.
 * @param {string} text
 * @param {(string|RegExp)[]} words
 * @returns {{type:'text'|'bleep', value:string}[]}
 */
export function splitForBleep(text, words = DEFAULT_BLEEP_WORDS) {
  const src = String(text ?? '');
  const list = (words || []).filter((w) => w instanceof RegExp || (w != null && String(w).length));
  if (!src) return [];
  if (!list.length) return [{ type: 'text', value: src }];
  // Longer literal strings first so "你妈的" wins over "你妈".
  const sorted = [...list].sort((a, b) => {
    const la = a instanceof RegExp ? 0 : String(a).length;
    const lb = b instanceof RegExp ? 0 : String(b).length;
    return lb - la;
  });
  const re = new RegExp(sorted.map(wordToSource).join('|'), 'gi');
  const out = [];
  const push = (type, value) => {
    if (!value) return;
    const last = out[out.length - 1];
    if (last && last.type === type && type === 'text') last.value += value;
    else out.push({ type, value });
  };
  let i = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    push('text', src.slice(i, m.index));
    push('bleep', m[0]);
    i = m.index + m[0].length;
  }
  push('text', src.slice(i));
  return out;
}

// Speech style → voice parameters. rate: 0.1..10 (1 = normal), pitch: 0..2 (1 = normal).
export const STYLE_VOICE = {
  // Kept within ~0.85-1.25x: many system voices stutter or clip at more extreme rates.
  real:    { rate: 1.05, pitch: 1.0 },
  curse:   { rate: 1.2,  pitch: 1.15 },
  disdain: { rate: 0.95, pitch: 0.85 },
  cold:    { rate: 0.85, pitch: 0.75 },
  deadpan: { rate: 1.0,  pitch: 0.9 },
  chuuni:  { rate: 1.1,  pitch: 1.1 },
  math:    { rate: 1.15, pitch: 1.0 },
  '250':   { rate: 1.1,  pitch: 1.05 },
  twist:   { rate: 1.1,  pitch: 1.05 },
  polite:  { rate: 1.0,  pitch: 1.35 },  // forced service voice "您好～"
  cust:    { rate: 1.05, pitch: 1.1 },   // customer lines
  boo:     { rate: 1.05, pitch: 0.8 },
  rage:    { rate: 1.25, pitch: 1.2 },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Resolve rate/pitch for a style; explicit opts.rate / opts.pitch override. */
export function styleParams(style, opts = {}) {
  const base = STYLE_VOICE[style] || STYLE_VOICE.real;
  return {
    rate: clamp(opts.rate ?? base.rate, 0.1, 10),
    pitch: clamp(opts.pitch ?? base.pitch, 0, 2),
  };
}

/** Chuuni lines start slow and dramatic, then accelerate: split at the first pause. */
export function chuuniSplit(text) {
  const s = String(text ?? '').trim();
  if (s.length < 4) return [s, ''];
  const m = /^(.{2,}?[，,。.！!？?…—；;：:]+)(.+)$/su.exec(s);
  if (m && m[2].trim()) return [m[1].trim(), m[2].trim()];
  const cut = Math.max(2, Math.round(s.length / 3));
  return [s.slice(0, cut), s.slice(cut)];
}

/**
 * Turn a line into a playback plan.
 * @returns {({type:'say', text, rate, pitch}|{type:'bleep', value})[]}
 */
export function buildSpeechPlan(text, { style = 'real', rate, pitch, bleep = false, words = DEFAULT_BLEEP_WORDS } = {}) {
  const clean = stripStage(text);
  if (!clean) return [];
  const p = styleParams(style, { rate, pitch });
  const sayParts = (t) => {
    if (!t.trim()) return [];
    return [{ type: 'say', text: t.trim(), rate: p.rate, pitch: p.pitch }];
  };
  if (!bleep) return sayParts(clean);
  const plan = [];
  for (const seg of splitForBleep(clean, words)) {
    if (seg.type === 'bleep') plan.push({ type: 'bleep', value: seg.value });
    else plan.push(...sayParts(seg.value));
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Audio engine
// ---------------------------------------------------------------------------

export function createAudio({ bleepWords = DEFAULT_BLEEP_WORDS, volume = 0.85, voiceFx = true } = {}) {
  const g = globalThis;
  const AC = g.AudioContext || g.webkitAudioContext;
  const synth = g.speechSynthesis || null;
  const Utter = g.SpeechSynthesisUtterance || null;

  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let distCurve = null;
  let lang = 'zh';
  let bleepOn = false;
  let words = bleepWords;
  let unlocked = false;
  let speechGen = 0;
  let crowdNodes = null;
  let voices = [];

  // ---- pre-rendered voice pack (tools/voice) ----
  // manifest: { langs: { zh|en: { chunks: [file], clips: { key: { c, o, d, b? } } } } }
  let pack = null;
  let packBase = '';
  const chunkCache = new Map(); // "lang:index" -> Promise<AudioBuffer|null>
  const speechSources = new Set();
  // Voice punch (VOICE_FX): false, true or an object merged over VOICE_FX; lite mode trims the chain.
  let fxCfg = voiceFx;
  let liteOn = false;

  // ---- voices ----
  const loadVoices = () => { try { voices = synth ? synth.getVoices() || [] : []; } catch { voices = []; } };
  if (synth) {
    loadVoices();
    try { synth.addEventListener?.('voiceschanged', loadVoices); } catch { /* ignore */ }
  }
  const norm = (l) => String(l || '').replace('_', '-').toLowerCase();
  function pickVoice() {
    if (!voices.length) loadVoices();
    const prefs = lang === 'en' ? ['en-us', 'en-'] : ['zh-tw', 'zh-cn', 'zh-hk', 'zh', 'cmn'];
    for (const p of prefs) {
      const v = voices.find((x) => norm(x.lang).startsWith(p));
      if (v) return v;
    }
    return null;
  }
  const speechLang = () => {
    if (lang === 'en') return 'en-US';
    const v = pickVoice();
    return v ? v.lang.replace('_', '-') : 'zh-TW';
  };

  // ---- WebAudio setup ----
  function ensureCtx() {
    if (ctx || !AC) return ctx;
    try {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(comp).connect(ctx.destination);
      // 2s white noise, reused by every noisy effect.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // Soft-clip distortion curve for rage.
      const n = 1024;
      distCurve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        distCurve[i] = Math.tanh(x * 6);
      }
    } catch {
      ctx = null;
    }
    return ctx;
  }

  const now = () => ctx.currentTime;

  function env(gainNode, t, { a = 0.005, peak = 1, d = 0.2, hold = 0 } = {}) {
    const p = gainNode.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    if (hold) p.setValueAtTime(Math.max(peak, 0.0002), t + a + hold);
    p.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
    return t + a + hold + d;
  }

  function osc(type, freq, t, end, dest) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(dest);
    o.start(t);
    o.stop(end + 0.05);
    return o;
  }

  function noise(t, end, dest, { loop = false } = {}) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = loop;
    s.connect(dest);
    s.start(t, Math.random() * 1.5);
    if (end != null) s.stop(end + 0.05);
    return s;
  }

  function gain(dest, v = 1) {
    const gn = ctx.createGain();
    gn.gain.value = v;
    gn.connect(dest);
    return gn;
  }

  function filter(type, freq, q, dest) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q != null) f.Q.value = q;
    f.connect(dest);
    return f;
  }

  // ---- SFX recipes ----
  const SFX = {
    // Counter slam (spec 8.5): 70→40 Hz sine body, 120 ms, plus a 15 ms noise click.
    slam(t, o) {
      const k = o.intensity ?? 1;
      const g1 = gain(master);
      const end = env(g1, t, { a: 0.003, peak: 1.0 * k, d: 0.12 });
      const thud = osc('sine', 70, t, end, g1);
      thud.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      const g2 = gain(master);
      const e2 = env(g2, t, { a: 0.001, peak: 0.8 * k, d: 0.015 });
      noise(t, e2, filter('highpass', 1200, 0.7, g2));
      const g3 = gain(master);
      const e3 = env(g3, t, { a: 0.001, peak: 0.3 * k, d: 0.04 });
      osc('square', 90, t, e3, filter('lowpass', 600, 0.7, g3));
      return end;
    },
    // Fast push-in swish (spec E3): band-passed noise 400 Hz → 3 kHz, 80 ms by default.
    // Longer durations (>= 0.2 s, the old fly-out) add the cartoon slide whistle.
    whoosh(t, o) {
      const dur = o.duration ?? 0.08;
      const k = o.intensity ?? 1;
      const g1 = gain(master);
      g1.gain.setValueAtTime(0.0001, t);
      g1.gain.exponentialRampToValueAtTime(0.9 * k, t + dur * 0.4);
      g1.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const bp = filter('bandpass', 400, 2.2, g1);
      bp.frequency.setValueAtTime(400, t);
      bp.frequency.exponentialRampToValueAtTime(3000, t + dur);
      noise(t, t + dur, bp);
      if (dur >= 0.2) {
        const g2 = gain(master);
        g2.gain.setValueAtTime(0.0001, t);
        g2.gain.exponentialRampToValueAtTime(0.18 * k, t + 0.05);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const w = osc('sine', 500, t, t + dur, g2);
        w.frequency.exponentialRampToValueAtTime(2200, t + dur);
      }
      return t + dur;
    },
    // Crowd booing: several detuned low saws through a vowel-ish formant, sagging pitch.
    boo(t, o) {
      const dur = o.duration ?? 1.3;
      const out = gain(master);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.5, t + 0.18);
      out.gain.setValueAtTime(0.5, t + dur * 0.6);
      out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const f1 = filter('bandpass', 450, 3, out);  // "oo" formant
      const f2 = filter('bandpass', 850, 4, gain(out, 0.5));
      const lp = filter('lowpass', 1100, 0.7, f1);
      lp.connect(f2);
      const voicesN = 6;
      for (let i = 0; i < voicesN; i++) {
        const base = 95 + Math.random() * 70;
        const start = t + Math.random() * 0.12;
        const s = osc('sawtooth', base, start, t + dur, lp);
        s.frequency.setValueAtTime(base, start);
        s.frequency.linearRampToValueAtTime(base * 0.82, t + dur);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 4 + Math.random() * 3;
        const lg = ctx.createGain();
        lg.gain.value = base * 0.03;
        lfo.connect(lg).connect(s.frequency);
        lfo.start(start);
        lfo.stop(t + dur + 0.05);
      }
      return t + dur;
    },
    // Cheer: clap-ish noise bursts + quick major arpeggio.
    cheer(t, o) {
      const dur = o.duration ?? 1.1;
      const ng = gain(master);
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.exponentialRampToValueAtTime(0.35, t + 0.08);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const bp = filter('bandpass', 2200, 0.8, ng);
      // Amplitude flutter = many hands clapping.
      const flutter = ctx.createGain();
      flutter.connect(bp);
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 13;
      const lg = ctx.createGain();
      lg.gain.value = 0.5;
      flutter.gain.value = 0.6;
      lfo.connect(lg).connect(flutter.gain);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
      noise(t, t + dur, flutter);
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        const st = t + i * 0.07;
        const gg = gain(master);
        const e = env(gg, st, { a: 0.005, peak: 0.22, d: 0.45 });
        osc('triangle', f, st, e, gg);
      });
      return t + dur;
    },
    // Order-number bell (spec: 1320 Hz, 600 ms decay).
    ding(t, o) {
      const f = o.freq ?? 1320;
      const d0 = o.decay ?? 0.6;
      let end = t;
      [[1, 0.5, d0], [2.76, 0.16, d0 * 0.5], [5.4, 0.06, d0 * 0.25]].forEach(([mul, pk, d]) => {
        const gg = gain(master);
        end = Math.max(end, env(gg, t, { a: 0.002, peak: pk, d }));
        osc('sine', f * mul, t, t + d + 0.01, gg);
      });
      return end;
    },
    // Customer pops up from under the counter: sine 300 → 900 Hz, 80 ms.
    pop(t) {
      const gg = gain(master);
      const end = env(gg, t, { a: 0.002, peak: 0.45, d: 0.08 });
      const s = osc('sine', 300, t, end, gg);
      s.frequency.exponentialRampToValueAtTime(900, t + 0.08);
      return end;
    },
    // Rage mode: distorted descending roar + sub rumble + slam.
    rage(t, o) {
      const dur = o.duration ?? 1.2;
      const shaper = ctx.createWaveShaper();
      shaper.curve = distCurve;
      shaper.oversample = '2x';
      const out = gain(master);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.55, t + 0.04);
      out.gain.setValueAtTime(0.55, t + dur * 0.5);
      out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const lp = filter('lowpass', 2400, 1, out);
      shaper.connect(lp);
      const pre = gain(shaper, 0.9);
      [1, 1.01, 1.5].forEach((m) => {
        const s = osc('sawtooth', 330 * m, t, t + dur, pre);
        s.frequency.exponentialRampToValueAtTime(48 * m, t + dur);
      });
      noise(t, t + dur, filter('lowpass', 300, 0.8, gain(pre, 0.8)));
      const sg = gain(master);
      env(sg, t, { a: 0.01, peak: 0.6, hold: dur * 0.4, d: dur * 0.5 });
      osc('sine', 55, t, t + dur, sg);
      SFX.slam(t, { intensity: 0.9 });
      return t + dur;
    },
    // Screen shake: tremolo low rumble.
    shake(t, o) {
      const dur = o.duration ?? 0.5;
      const out = gain(master);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.7, t + 0.02);
      out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const trem = ctx.createGain();
      trem.gain.value = 0.5;
      trem.connect(out);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 18;
      const lg = ctx.createGain();
      lg.gain.value = 0.5;
      lfo.connect(lg).connect(trem.gain);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
      noise(t, t + dur, filter('lowpass', 160, 1, trem));
      osc('sine', 45, t, t + dur, gain(trem, 0.6));
      return t + dur;
    },
    // Milestone fanfare: ta-ta-ta-TAAA + bell.
    milestone(t) {
      const seq = [[523.25, 0, 0.1], [523.25, 0.12, 0.1], [523.25, 0.24, 0.1], [783.99, 0.36, 0.6]];
      let end = t;
      seq.forEach(([f, off, d]) => {
        const st = t + off;
        [1, 1.26, 1.5].forEach((m, i) => {
          if (i && off < 0.36) return;
          const gg = gain(master);
          end = Math.max(end, env(gg, st, { a: 0.01, peak: 0.16, hold: d * 0.6, d: d * 0.6 }));
          osc('square', f * m, st, st + d * 1.3, filter('lowpass', 3000, 0.7, gg));
        });
      });
      SFX.ding(t + 0.36, { freq: 2093 });
      return end;
    },
    // Censor bleep: classic 1 kHz sine.
    bleep(t, o) {
      const dur = o.duration ?? 0.28;
      const gg = gain(master);
      gg.gain.setValueAtTime(0.0001, t);
      gg.gain.linearRampToValueAtTime(0.4, t + 0.008);
      gg.gain.setValueAtTime(0.4, t + dur - 0.01);
      gg.gain.linearRampToValueAtTime(0.0001, t + dur);
      osc('sine', 1000, t, t + dur, gg);
      return t + dur;
    },

    // ---- first-minute set (spec 8.5 item 5); all synthesized ----
    // Rolling shutter: noise through a band-pass sweeping 2 kHz → 600 Hz, rattled at 28 Hz, 500 ms.
    gate(t, o) {
      const dur = o.duration ?? 0.5;
      const out = gain(master);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.5, t + 0.04);
      out.gain.setValueAtTime(0.5, t + dur * 0.7);
      out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const rattle = ctx.createGain();
      rattle.gain.value = 0.6;
      const bp = filter('bandpass', 2000, 3, rattle);
      bp.frequency.setValueAtTime(2000, t);
      bp.frequency.exponentialRampToValueAtTime(600, t + dur);
      rattle.connect(out);
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 28;
      const lg = ctx.createGain();
      lg.gain.value = 0.4;
      lfo.connect(lg).connect(rattle.gain);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
      noise(t, t + dur, bp);
      return t + dur;
    },
    // Low boom under the big punch: 55 Hz, 300 ms.
    boom(t, o) {
      const k = o.intensity ?? 1;
      const gg = gain(master);
      const end = env(gg, t, { a: 0.004, peak: 0.95 * k, d: 0.3 });
      const s = osc('sine', 62, t, end, gg);
      s.frequency.exponentialRampToValueAtTime(48, t + 0.3);
      const g2 = gain(master);
      env(g2, t, { a: 0.002, peak: 0.25 * k, d: 0.08 });
      osc('triangle', 110, t, t + 0.1, g2);
      return end;
    },
    // Key press: 30 ms click.
    press(t) {
      const gg = gain(master);
      const end = env(gg, t, { a: 0.001, peak: 0.5, d: 0.03 });
      noise(t, end, filter('highpass', 2500, 0.7, gg));
      const g2 = gain(master);
      env(g2, t, { a: 0.001, peak: 0.25, d: 0.012 });
      osc('square', 1200, t, t + 0.02, g2);
      return end;
    },
    // Sign flipped up: high-passed white noise, 90 ms.
    card(t) {
      const gg = gain(master);
      gg.gain.setValueAtTime(0.0001, t);
      gg.gain.exponentialRampToValueAtTime(0.35, t + 0.015);
      gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      noise(t, t + 0.09, filter('highpass', 3000, 0.8, gg));
      return t + 0.09;
    },
    // Typewriter tick for S5 cards.
    tick(t) {
      const gg = gain(master);
      const end = env(gg, t, { a: 0.001, peak: 0.22, d: 0.018 });
      osc('square', 2400, t, end, filter('bandpass', 2400, 4, gg));
      return end;
    },
    // Fingers drumming on the counter: o.count knocks (default 3), 120 ms apart.
    tap(t, o) {
      const n = o.count ?? 3;
      let end = t;
      for (let i = 0; i < n; i++) {
        const st = t + i * (o.interval ?? 0.12);
        const gg = gain(master);
        end = env(gg, st, { a: 0.001, peak: 0.5, d: 0.05 });
        const s = osc('sine', 190, st, end, gg);
        s.frequency.exponentialRampToValueAtTime(120, st + 0.05);
        const g2 = gain(master);
        const e2 = env(g2, st, { a: 0.001, peak: 0.2, d: 0.02 });
        noise(st, e2, filter('bandpass', 900, 2, g2));
      }
      return end;
    },
    // Coin: two square blips (B5 → E6). o.pitch shifts it (coin runs climb a little).
    coin(t, o) {
      const m = o.pitch ?? 1;
      const g1 = gain(master);
      env(g1, t, { a: 0.001, peak: 0.16, d: 0.06 });
      osc('square', 988 * m, t, t + 0.07, filter('lowpass', 5000, 0.7, g1));
      const g2 = gain(master);
      const end = env(g2, t + 0.06, { a: 0.001, peak: 0.16, hold: 0.04, d: 0.2 });
      osc('square', 1319 * m, t + 0.06, end, filter('lowpass', 5000, 0.7, g2));
      return end;
    },
    // Service desk bell: inharmonic partials, long decay.
    bell(t) {
      let end = t;
      [[2100, 0.4, 1.2], [5250, 0.12, 0.7], [7900, 0.05, 0.4]].forEach(([f, pk, d]) => {
        const gg = gain(master);
        end = Math.max(end, env(gg, t, { a: 0.001, peak: pk, d }));
        osc('sine', f, t, t + d + 0.01, gg);
      });
      return end;
    },
    // Number caller: ding-dong (E5 → C5).
    dingdong(t) {
      let end = t;
      [[659.25, 0], [523.25, 0.42]].forEach(([f, off]) => {
        const st = t + off;
        [[1, 0.35, 0.9], [3, 0.08, 0.4]].forEach(([mul, pk, d]) => {
          const gg = gain(master);
          end = Math.max(end, env(gg, st, { a: 0.003, peak: pk, d }));
          osc('sine', f * mul, st, st + d + 0.01, gg);
        });
      });
      return end;
    },
    // Cartoon slap "啪" (gesture taps): a bright clap of high-passed noise over a short low knock.
    slap(t, o) {
      const k = o.intensity ?? 1;
      const g1 = gain(master);
      const e1 = env(g1, t, { a: 0.001, peak: 0.9 * k, d: 0.045 });
      noise(t, e1, filter('highpass', 1800, 0.8, g1));
      const g2 = gain(master);
      const e2 = env(g2, t, { a: 0.001, peak: 0.5 * k, d: 0.06 });
      const s = osc('triangle', 260, t, e2, g2);
      s.frequency.exponentialRampToValueAtTime(140, t + 0.06);
      return Math.max(e1, e2);
    },
    // Rubber stamp: dull thump + paper slap.
    stamp(t) {
      const gg = gain(master);
      const end = env(gg, t, { a: 0.002, peak: 0.8, d: 0.09 });
      const s = osc('sine', 130, t, end, gg);
      s.frequency.exponentialRampToValueAtTime(55, t + 0.09);
      const g2 = gain(master);
      const e2 = env(g2, t, { a: 0.001, peak: 0.45, d: 0.05 });
      noise(t, e2, filter('lowpass', 700, 0.8, g2));
      return end;
    },
    // Clock ticks: o.count ticks (default 4), o.interval apart (default 250 ms), tick/tock alternating.
    clock(t, o) {
      const n = o.count ?? 4;
      let end = t;
      for (let i = 0; i < n; i++) {
        const st = t + i * (o.interval ?? 0.25);
        const gg = gain(master);
        end = env(gg, st, { a: 0.001, peak: 0.3, d: 0.025 });
        osc('square', i % 2 ? 1400 : 1800, st, end, filter('bandpass', i % 2 ? 1400 : 1800, 6, gg));
      }
      return end;
    },
    // Sigh: pink-ish noise (white through an 800 Hz low-pass), envelope 0 → 1 → 0 over 450 ms.
    sigh(t, o) {
      const dur = o.duration ?? 0.45;
      const gg = gain(master);
      gg.gain.setValueAtTime(0.0001, t);
      gg.gain.linearRampToValueAtTime(0.5, t + dur * 0.35);
      gg.gain.linearRampToValueAtTime(0.0001, t + dur);
      const lp = filter('lowpass', 800, 0.7, gg);
      lp.frequency.setValueAtTime(900, t);
      lp.frequency.linearRampToValueAtTime(500, t + dur);
      noise(t, t + dur, filter('lowpass', 1600, 0.5, lp));
      return t + dur;
    },
    // Record scratch (W3 brake).
    scratch(t) {
      const dur = 0.28;
      const gg = gain(master);
      gg.gain.setValueAtTime(0.0001, t);
      gg.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
      gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const bp = filter('bandpass', 3000, 4, gg);
      bp.frequency.setValueAtTime(3000, t);
      bp.frequency.exponentialRampToValueAtTime(500, t + 0.12);
      bp.frequency.exponentialRampToValueAtTime(2200, t + dur);
      noise(t, t + dur, bp);
      const g2 = gain(master);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const s = osc('sawtooth', 600, t, t + dur, filter('lowpass', 2000, 1, g2));
      s.frequency.exponentialRampToValueAtTime(140, t + 0.12);
      s.frequency.exponentialRampToValueAtTime(420, t + dur);
      return t + dur;
    },
    // Mic feedback squeal under "调你妈": 2.8 kHz, 150 ms, about -14 dB.
    feedback(t, o) {
      const dur = o.duration ?? 0.15;
      const gg = gain(master);
      gg.gain.setValueAtTime(0.0001, t);
      gg.gain.exponentialRampToValueAtTime(0.2, t + 0.03);
      gg.gain.setValueAtTime(0.2, t + dur - 0.03);
      gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const s = osc('sine', 2800, t, t + dur, gg);
      s.frequency.linearRampToValueAtTime(2860, t + dur);
      return t + dur;
    },
    // Gold shine: rising arpeggio.
    sparkle(t) {
      let end = t;
      [1046.5, 1318.5, 1568, 2093, 2637, 3136].forEach((f, i) => {
        const st = t + i * 0.06;
        const gg = gain(master);
        end = Math.max(end, env(gg, st, { a: 0.003, peak: 0.13, d: 0.35 }));
        osc('triangle', f, st, st + 0.36, gg);
      });
      return end;
    },
    // Snare roll with a crescendo (D1): 16th-note-or-faster hits for o.duration (default 800 ms).
    drumroll(t, o) {
      const dur = o.duration ?? 0.8;
      const step = o.step ?? 0.045;
      const n = Math.max(1, Math.floor(dur / step));
      for (let i = 0; i < n; i++) {
        const st = t + i * step;
        const gg = gain(master);
        env(gg, st, { a: 0.001, peak: 0.12 + 0.3 * (i / n), d: 0.04 });
        noise(st, st + 0.05, filter('bandpass', 1800, 0.9, gg));
      }
      return t + dur;
    },
    // Crowd "ohhh": noise through three formant band-passes, 400 ms build, then release.
    crowdOh(t, o) {
      const build = o.duration ?? 0.4;
      const dur = build + 0.6;
      const out = gain(master);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(o.peak ?? 0.45, t + build);
      out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      [[500, 6, 1], [1000, 7, 0.6], [2400, 8, 0.25]].forEach(([f, q, v]) => {
        const bp = filter('bandpass', f, q, gain(out, v));
        bp.frequency.setValueAtTime(f * 0.85, t);
        bp.frequency.linearRampToValueAtTime(f, t + build);
        noise(t, t + dur, bp);
      });
      return t + dur;
    },
    // Customer cut off mid-order: short rising "huh?".
    huh(t) {
      const dur = 0.18;
      const gg = gain(master);
      gg.gain.setValueAtTime(0.0001, t);
      gg.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const s = osc('sawtooth', 210, t, t + dur, filter('bandpass', 900, 3, gg));
      s.frequency.exponentialRampToValueAtTime(330, t + dur);
      return t + dur;
    },
  };

  // Looping sounds (musicbox, hum) start with loop(name) and run until stopped.
  const LOOPS = {
    // C-major arpeggio music box, about -12 dB; handle.detune(cents) bends it (W4 +900: -50 cents).
    musicbox(o) {
      const out = gain(master, 0.25);
      const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25];
      const stepS = o.step ?? 0.16;
      let detune = o.detune ?? 0;
      let i = 0;
      let next = now() + 0.02;
      const live = new Set();
      const pump = () => {
        while (next < now() + 0.25) {
          const gg = gain(out);
          const end = env(gg, next, { a: 0.003, peak: 0.5, d: 0.45 });
          const s = osc('triangle', notes[i++ % notes.length], next, end, gg);
          s.detune.value = detune;
          live.add(s);
          s.onended = () => live.delete(s);
          next += stepS;
        }
      };
      pump();
      const timer = setInterval(pump, 80);
      return {
        out,
        detune(c) { detune = c; live.forEach((s) => { try { s.detune.setValueAtTime(c, now()); } catch { /* ended */ } }); },
        dispose() { clearInterval(timer); },
      };
    },
    // Air-conditioner hum, about -30 dB: low-passed noise + 60 Hz.
    hum(o) {
      const out = gain(master, o.level ?? 0.032);
      const n = noise(now(), null, filter('lowpass', 180, 0.7, out), { loop: true });
      const s = ctx.createOscillator();
      s.frequency.value = 60;
      s.connect(gain(out, 0.5));
      s.start();
      return { out, detune() {}, dispose() { try { s.stop(now() + 0.3); n.stop(now() + 0.3); } catch { /* ignore */ } } };
    },
  };

  function sfx(name, opts = {}) {
    if (!unlocked || !ensureCtx() || !SFX[name]) return 0;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const end = SFX[name](now() + (opts.delay ?? 0), opts);
      return Math.max(0, end - now());
    } catch {
      return 0;
    }
  }

  // ---- crowd ambience ----
  // ---- bed: crowd murmur + 110 BPM rhythm on one bus that duck()/restore() move (spec 3.1, 8.5 item 6) ----
  let bedBus = null;
  let rhythm = null;
  function ensureBed() {
    if (!bedBus) bedBus = gain(master, 1);
    return bedBus;
  }
  /** Press the bed (crowd + rhythm) down to toDb within ms. Default: the spec's "silence" (-60 dB in 30 ms). */
  function duck(toDb = -60, ms = 30) {
    if (!unlocked || !ensureCtx()) return;
    try {
      const p = ensureBed().gain;
      const t = now();
      p.cancelScheduledValues(t);
      p.setValueAtTime(Math.max(p.value, 0.0001), t);
      p.exponentialRampToValueAtTime(Math.max(dbToGain(toDb), 0.0001), t + Math.max(ms, 1) / 1000);
    } catch { /* ignore */ }
  }
  /** Bring the bed back to full level over ms (optionally after delayMs). */
  function restore(ms = 200, delayMs = 0) {
    if (!unlocked || !ensureCtx()) return;
    try {
      const p = ensureBed().gain;
      const t = now() + Math.max(0, delayMs) / 1000;
      p.cancelScheduledValues(t);
      p.setValueAtTime(Math.max(p.value, 0.0001), t);
      p.exponentialRampToValueAtTime(1, t + Math.max(ms, 1) / 1000);
    } catch { /* ignore */ }
  }
  // 110 BPM, 4-bar loop: low bass on beats 1 and 3 (a fifth up in bar 4), closed hat on every eighth. -18 dB.
  function startRhythm() {
    if (rhythm) return;
    const out = gain(ensureBed(), dbToGain(-18));
    const beat = 60 / 110;
    let step = 0;
    let next = now() + 0.05;
    const pump = () => {
      while (next < now() + 0.3) {
        const bar = Math.floor(step / 8) % 4;
        const pos = step % 8;
        if (pos === 0 || pos === 4) {
          const gg = gain(out);
          const end = env(gg, next, { a: 0.005, peak: 0.9, d: 0.22 });
          const s = osc('sine', bar === 3 && pos === 4 ? 82.4 : 55, next, end, gg);
          s.frequency.exponentialRampToValueAtTime(bar === 3 && pos === 4 ? 70 : 46, next + 0.2);
        }
        const hg = gain(out);
        const he = env(hg, next, { a: 0.001, peak: pos % 2 ? 0.25 : 0.4, d: 0.03 });
        noise(next, he, filter('highpass', 7000, 0.7, hg));
        step++;
        next += beat / 2;
      }
    };
    pump();
    rhythm = { out, timer: setInterval(pump, 100) };
  }
  function stopRhythm() {
    if (!rhythm) return;
    clearInterval(rhythm.timer);
    try { rhythm.out.gain.setTargetAtTime(0.0001, now(), 0.05); } catch { /* ignore */ }
    rhythm = null;
  }
  /** Night-market bed: bed(true) = crowd murmur + rhythm; bed(false) stops the rhythm and the crowd. */
  function bed(on = true, level = 0.12) {
    if (!unlocked || !ensureCtx()) return;
    try {
      if (on) { crowd(Math.max(level, crowdNodes?.level || 0)); startRhythm(); } else { stopRhythm(); crowd(0); }
    } catch { /* ignore */ }
  }

  // ---- loops ----
  const loops = new Map(); // name -> { out, detune, dispose }
  /** Start a looping sound ('musicbox' | 'hum'); returns { stop(ms), detune(cents) }. Restarting replaces it. */
  function loop(name, opts = {}) {
    const dummy = { stop() {}, detune() {} };
    if (!unlocked || !ensureCtx() || !LOOPS[name]) return dummy;
    stopLoop(name, 20);
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const h = LOOPS[name](opts);
      loops.set(name, h);
      return { stop: (ms) => stopLoop(name, ms), detune: (c) => h.detune(c) };
    } catch { return dummy; }
  }
  function stopLoop(name, ms = 20) {
    const h = loops.get(name);
    if (!h) return;
    loops.delete(name);
    try {
      const t = now();
      h.out.gain.cancelScheduledValues(t);
      h.out.gain.setValueAtTime(h.out.gain.value, t);
      h.out.gain.linearRampToValueAtTime(0, t + Math.max(ms, 1) / 1000);
      setTimeout(() => h.dispose(), ms + 50);
    } catch { /* ignore */ }
  }
  const stopLoops = (ms = 20) => [...loops.keys()].forEach((n) => stopLoop(n, ms));

  function buildCrowd() {
    const out = gain(ensureBed(), 0);
    // Two murmur bands, each amplitude-wobbled at irregular rates → babble.
    const bands = [[350, 1.2, 3.3], [900, 1.5, 4.7], [1800, 2, 6.1]].map(([f, q, rate], i) => {
      const am = ctx.createGain();
      am.gain.value = 0.6;
      const bp = filter('bandpass', f, q, gain(out, i === 2 ? 0.35 : 1));
      am.connect(bp);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rate;
      const lg = ctx.createGain();
      lg.gain.value = 0.4;
      lfo.connect(lg).connect(am.gain);
      lfo.start();
      noise(now(), null, am, { loop: true });
      return { bp, base: f };
    });
    return { out, bands, level: 0 };
  }

  function crowd(level = 0) {
    const lv = clamp(Number(level) || 0, 0, 1);
    if (!unlocked || !ensureCtx()) return;
    try {
      if (!crowdNodes) {
        if (lv <= 0) return;
        crowdNodes = buildCrowd();
      }
      const t = now();
      crowdNodes.level = lv;
      crowdNodes.out.gain.setTargetAtTime(lv * 0.32, t, 0.4);
      // Excited crowds get brighter.
      crowdNodes.bands.forEach(({ bp, base }) => bp.frequency.setTargetAtTime(base * (1 + lv * 0.35), t, 0.6));
    } catch { /* ignore */ }
  }

  // ---- speech ----
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function sayOnce(text, rate, pitch, gen) {
    return new Promise((resolve) => {
      if (!synth || !Utter || gen !== speechGen) return resolve();
      let done = false;
      const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
      // Safety net: some engines never fire onend.
      const est = 600 + (text.length * (lang === 'en' ? 90 : 260)) / rate;
      const timer = setTimeout(finish, Math.min(20000, est * 1.6 + 1500));
      try {
        const u = new Utter(text);
        u.lang = speechLang();
        const v = pickVoice();
        if (v) u.voice = v;
        u.rate = rate;
        u.pitch = pitch;
        u.volume = 1;
        u.onend = finish;
        u.onerror = finish;
        synth.speak(u);
      } catch {
        finish();
      }
    });
  }

  // ---- voice pack playback ----
  async function loadVoicePack(url = 'voice/manifest.json') {
    try {
      const res = await fetch(url);
      if (!res.ok) return false;
      pack = await res.json();
      packBase = url.slice(0, url.lastIndexOf('/') + 1);
      return true;
    } catch {
      pack = null;
      return false;
    }
  }

  function findClip(text, l = lang) {
    const clip = pack?.langs?.[l]?.clips?.[clipKey(l, text)];
    if (!clip) return null;
    return bleepOn && clip.b ? clip.b : clip;
  }

  function chunk(l, index) {
    const id = `${l}:${index}`;
    if (!chunkCache.has(id)) {
      const name = pack?.langs?.[l]?.chunks?.[index];
      const p = !name || !ensureCtx()
        ? Promise.resolve(null)
        : fetch(packBase + name)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
          .then((buf) => ctx.decodeAudioData(buf))
          .catch(() => { chunkCache.delete(id); return null; });
      chunkCache.set(id, p);
    }
    return chunkCache.get(id);
  }

  /** Decode the current language's sprites in the background so the first lines play without delay. */
  async function preloadVoice(l = lang) {
    const n = pack?.langs?.[l]?.chunks?.length || 0;
    for (let i = 0; i < n; i++) await chunk(l, i);
  }

  // Legacy punch chain (spec 8.5 item 2): +4 dB; curse adds a WaveShaper (k = 8); mega adds a 70 ms echo
  // (25 % wet). Used when the voice punch (VOICE_FX) is off, and for whole lines that are not a hit.
  let punchCurve = null;
  function hotCurve() {
    if (!punchCurve) {
      const n = 1024;
      const k = 8;
      punchCurve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        punchCurve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
      }
    }
    return punchCurve;
  }
  function punchChain(fx, dest) {
    const out = gain(dest, 1.585);
    if (fx !== 'curse' && fx !== 'mega') return out;
    const shaper = ctx.createWaveShaper();
    shaper.curve = hotCurve();
    shaper.oversample = '2x';
    shaper.connect(out);
    const pre = gain(shaper, 0.7); // keep the clipped level close to the clean one
    if (fx === 'mega') {
      const delay = ctx.createDelay(0.5);
      delay.delayTime.value = 0.07;
      delay.connect(gain(dest, 0.25 * 1.585));
      pre.connect(delay);
    }
    return pre;
  }

  // Voice punch chain (VOICE_FX): [megaphone blend] → shaper → drive → compressor (fast attack) → makeup → dest,
  // plus the mega echo tapped after the compressor. Returns the input node.
  const gentleCurves = new Map();
  function gentleCurve(k) {
    if (!gentleCurves.has(k)) {
      const n = 1024;
      const c = new Float32Array(n);
      const norm = Math.tanh(k);
      for (let i = 0; i < n; i++) c[i] = Math.tanh(k * ((i / (n - 1)) * 2 - 1)) / norm;
      gentleCurves.set(k, c);
    }
    return gentleCurves.get(k);
  }
  function voiceChain(plan, dest) {
    const c = (fxConfig(fxCfg) || VOICE_FX).compressor || VOICE_FX.compressor;
    const makeup = gain(dest, dbToGain(plan.makeupDb || 0));
    let head = makeup;
    if (plan.compress) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = c.threshold;
      comp.knee.value = c.knee;
      comp.ratio.value = c.ratio;
      comp.attack.value = c.attack;
      comp.release.value = c.release;
      comp.connect(head);
      head = comp;
    }
    if (plan.echo) {
      const delay = ctx.createDelay(0.5);
      delay.delayTime.value = 0.07;
      delay.connect(gain(dest, 0.25));
      makeup.connect(delay);
    }
    head = gain(head, dbToGain(plan.driveDb || 0));
    if (plan.saturation) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = plan.saturation === 'hot' ? hotCurve() : gentleCurve(plan.saturation);
      shaper.oversample = '2x';
      shaper.connect(head);
      // the k = 8 curve is loud on its own: trim into it like the legacy chain
      head = plan.saturation === 'hot' ? gain(shaper, 0.7) : shaper;
    }
    if (!plan.megaphone) return head;
    // Subtle megaphone: 65 % dry + a 600 Hz–3.2 kHz band with a 1.8 kHz bump.
    const input = ctx.createGain();
    input.connect(gain(head, 0.65));
    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 1800;
    peak.Q.value = 1.2;
    peak.gain.value = 6;
    peak.connect(gain(head, 0.55));
    input.connect(filter('highpass', 600, 0.7, filter('lowpass', 3200, 0.7, peak)));
    return input;
  }

  // Impact transient layered on the onset of a hit: low thump (sine 120 → 45 Hz, 120 ms) + slap (noise burst
  // band-passed at 2.2 kHz, 30 ms). Registered as a speech source so cut() also silences a pending one.
  function impact(t, k = 1, gen = speechGen) {
    if (gen !== speechGen) return;
    const out = gain(master, 1);
    const g1 = gain(out);
    env(g1, t, { a: 0.002, peak: 0.55 * k, d: 0.12 });
    const thump = osc('sine', 120, t, t + 0.13, g1);
    thump.frequency.exponentialRampToValueAtTime(45, t + 0.11);
    const g2 = gain(out);
    env(g2, t, { a: 0.0008, peak: 0.42 * k, d: 0.03 });
    const slap = noise(t, t + 0.035, filter('bandpass', 2200, 0.9, g2));
    const entry = {
      fadeGain: out,
      stop(at) { try { thump.stop(at); } catch { /* ended */ } try { slap.stop(at); } catch { /* ended */ } },
    };
    speechSources.add(entry);
    setTimeout(() => speechSources.delete(entry), Math.max(0, (t - now()) * 1000) + 400);
  }

  // Plays one clip. Speech clips are cancelled by stopSpeech()/cut(); announcer clips are not.
  // at: absolute AudioContext time (overrides delay). rate: playback rate (customers' 4.2 speed-up).
  // plan: one half from voicePlan() (rate, level, chain, impact); fx: legacy punch chain without a plan.
  async function playClip(clip, { style, delay = 0, at, speech = true, gen = speechGen, gainValue = 1, rate, fx, plan, buffer } = {}) {
    buffer = buffer || await chunk(lang, clip.c);
    if (!buffer || (speech && gen !== speechGen)) return;
    if (ctx.state === 'suspended') ctx.resume();
    await new Promise((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate ?? plan?.rate ?? (fx === 'mega' ? PUNCH_RATE.mega : CLIP_RATE[style] || 1);
      const g = gain(master, gainValue * dbToGain(plan?.gainDb || 0));
      const legacyFx = plan ? (plan.chain === 'legacy' ? plan.fx : null) : fx;
      let input = g;
      try {
        if (plan?.chain === 'punch') input = voiceChain(plan, g);
        else if (legacyFx) input = punchChain(legacyFx, g);
      } catch { input = g; } // a missing node type never costs the line
      src.connect(input);
      src.fadeGain = g; // stopSpeech() / cut() fade this out instead of cutting mid-syllable
      const startAt = Math.max(at ?? now() + delay, now());
      const done = () => { speechSources.delete(src); clearTimeout(timer); resolve(); };
      src.onended = done;
      const timer = setTimeout(done, ((startAt - now()) + clip.d / src.playbackRate.value) * 1000 + 800);
      if (speech) speechSources.add(src);
      src.start(startAt, clip.o, clip.d);
      if (plan?.impact) { try { impact(startAt, plan.impactGain ?? 1, gen); } catch { /* ignore */ } }
    });
  }

  // Web Speech fallback for one part of a line (numbers rewritten for TTS, bleeps honoured).
  async function sayFallback(text, opts, gen) {
    const plan = buildSpeechPlan(ttsText(text, lang), { ...opts, bleep: bleepOn, words });
    for (const step of plan) {
      if (gen !== speechGen) return;
      if (step.type === 'bleep') {
        const secs = sfx('bleep', { duration: clamp(0.12 + step.value.length * 0.07, 0.2, 0.5) });
        await wait(secs * 1000 + 30);
      } else if (synth && Utter) {
        await sayOnce(step.text, step.rate, step.pitch, gen);
      }
    }
  }

  /** Clip-based timing of a line in the current language (sync; estimates when a clip is missing). */
  function voiceTimings(text, opts = {}) {
    if (opts.punchOnly) text = punchOnlyText(text);
    return timingsFromManifest(pack, opts.lang || lang, text, { bleep: bleepOn, voiceFx: fxCfg, lite: liteOn, ...opts });
  }
  const planFor = (text, opts) => voicePlan(text, { voiceFx: fxCfg, lite: liteOn, ...opts });

  const withTiming = (promise, timing) => Object.assign(promise, timing);

  /**
   * Clerk line with a '|' cut point (spec 8.5 item 1). Setup clip → punchGapMs of silence (the bed is
   * pressed to -60 dB in 30 ms at the end of the setup) → punch clip through the punch chain; the bed comes
   * back bedBackMs after the punch ends. Without '|' the whole line is the punch (setupMs 0, no ducking).
   * With the voice punch on (VOICE_FX), the hit half gets the punch chain, punchRate and an impact at its
   * onset, the polite setup plays clean and softer, and a hit without a setup waits breathMs (see voicePlan()).
   * Cuts any speech already playing. Returns a Promise (resolves when the line ends) that also carries
   * { setupMs, gapMs, punchStartMs, punchMs, totalMs } synchronously.
   */
  function playClerk(text, { punchGapMs = 200, punchFx = 'normal', bedBackMs = 200, style, duckBed = true, punchOnly = false } = {}) {
    if (punchOnly) text = punchOnlyText(text);
    const timing = voiceTimings(text, { punchGapMs, punchFx, style });
    const plan = planFor(text, { fx: punchFx, style });
    if (!unlocked) return withTiming(Promise.resolve(timing), timing);
    stopSpeech();
    const gen = speechGen;
    const [setup, punch] = splitPunch(text);
    const hasSetup = !!stripStage(setup);
    const cs = hasSetup ? findClip(setup) : null;
    const cp = stripStage(punch) ? findClip(punch) : null;
    const run = (async () => {
      if (!ensureCtx()) return timing;
      const needSetup = hasSetup && !cs;
      const needPunch = stripStage(punch) && !cp;
      if (!needSetup && !needPunch) {
        // Both halves pre-rendered: schedule sample-accurately on the AudioContext clock (K5).
        const [bs, bp] = await Promise.all([cs ? chunk(lang, cs.c) : null, cp ? chunk(lang, cp.c) : null]);
        if (gen !== speechGen) return timing;
        const t0 = now() + 0.02;
        const tp = t0 + timing.punchStartMs / 1000;
        if (hasSetup && duckBed && bedBus) {
          const d = ensureBed().gain;
          const te = t0 + timing.setupMs / 1000;
          d.cancelScheduledValues(te);
          d.setValueAtTime(Math.max(d.value, 0.0001), te);
          d.exponentialRampToValueAtTime(0.001, te + 0.03);
        }
        const jobs = [];
        if (cs && bs) jobs.push(playClip(cs, { at: t0, gen, buffer: bs, plan: plan.setup }));
        if (cp && bp) jobs.push(playClip(cp, { at: tp, gen, buffer: bp, plan: plan.punch }));
        if (hasSetup && duckBed) restore(200, timing.totalMs + bedBackMs);
        await Promise.all(jobs);
        return timing;
      }
      // Some half has no clip: play part by part (Web Speech where needed).
      const opts = { style: style || (punchFx === 'curse' ? 'curse' : 'real') };
      // Web Speech cannot go through WebAudio: a hit half spoken by it still gets its impact.
      const speakHalf = (part, p) => {
        if (p?.impact) { try { impact(now(), p.impactGain ?? 1, gen); } catch { /* ignore */ } }
        return sayFallback(part, opts, gen);
      };
      if (hasSetup) {
        if (cs) await playClip(cs, { gen, plan: plan.setup }); else await speakHalf(setup, plan.setup);
        if (gen !== speechGen) return timing;
        if (duckBed) duck(-60, 30);
        await wait(punchGapMs);
      } else if (plan.breathMs) await wait(plan.breathMs);
      if (gen !== speechGen) return timing;
      if (cp) await playClip(cp, { gen, plan: plan.punch }); else if (stripStage(punch)) await speakHalf(punch, plan.punch);
      if (hasSetup && duckBed) restore(200, bedBackMs);
      return timing;
    })().catch(() => timing);
    return withTiming(run, timing);
  }

  /**
   * Customer line (spec 8.5 item 3), sped up with playbackRate = rate (pitch rises with it). Does not cut
   * the clerk; cut() / stopSpeech() cut it. Returns a Promise carrying { ms } (duration at that rate).
   */
  function playCustomer(text, { rate = 1 } = {}) {
    const ms = voiceTimings(text, { rate }).totalMs;
    if (!unlocked) return withTiming(Promise.resolve({ ms }), { ms });
    const gen = speechGen;
    const clip = findClip(unpipe(text));
    const run = (async () => {
      if (clip && ensureCtx()) await playClip(clip, { gen, rate });
      else await sayFallback(unpipe(text), { style: 'cust', rate: STYLE_VOICE.cust.rate * rate }, gen);
      return { ms };
    })().catch(() => ({ ms }));
    return withTiming(run, { ms });
  }

  /** Fade every voice out within ms (default 40: the W3 brake, a customer interrupted by an early press). */
  function cut(ms = 40) {
    speechGen++;
    for (const src of speechSources) {
      try {
        const t = now();
        src.fadeGain.gain.setValueAtTime(src.fadeGain.gain.value, t);
        src.fadeGain.gain.linearRampToValueAtTime(0, t + ms / 1000);
        src.stop(t + ms / 1000 + 0.01);
      } catch { /* already stopped */ }
    }
    speechSources.clear();
    try { synth?.cancel(); } catch { /* ignore */ }
  }

  /** Everything to silence within ms (spec E1): voices cut, loops stopped, bed pressed to -60 dB. */
  function hush(ms = 20) {
    cut(ms);
    stopLoops(ms);
    duck(-60, ms);
  }

  /** Play a line from the voice pack without interrupting the clerk (crowd boos, milestone announcer). */
  function announce(text, { delay = 0, style, gainValue = 0.8 } = {}) {
    if (!unlocked) return Promise.resolve();
    const clip = findClip(text);
    if (!clip || !ensureCtx()) return Promise.resolve();
    return playClip(clip, { style, delay, speech: false, gainValue }).catch(() => {});
  }

  async function speak(text, opts = {}) {
    if (!unlocked) return;
    if (String(text ?? '').includes('|')) {
      await playClerk(text, { style: opts.style, punchFx: opts.style === 'curse' ? 'curse' : 'normal' });
      return;
    }
    // Rage / curse lines (the rage chant) get the voice punch; everything else plays as before.
    const plan = planFor(text, { style: opts.style, via: 'speak' });
    const gen = speechGen;
    const clip = findClip(text);
    if (clip && ensureCtx()) {
      await playClip(clip, { style: opts.style, gen, plan: plan.punch, delay: plan.breathMs / 1000 });
      return;
    }
    if (plan.breathMs) await wait(plan.breathMs);
    if (plan.punch.impact && ensureCtx()) { try { impact(now(), plan.punch.impactGain ?? 1, gen); } catch { /* ignore */ } }
    await sayFallback(text, opts, gen);
  }

  function stopSpeech() {
    cut(60);
  }

  function unlock() {
    unlocked = true;
    if (ensureCtx()) {
      try {
        if (ctx.state === 'suspended') ctx.resume();
        // Play one silent sample so iOS Safari fully unlocks output.
        const b = ctx.createBuffer(1, 1, ctx.sampleRate);
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(ctx.destination);
        s.start(0);
      } catch { /* ignore */ }
    }
    if (synth && Utter) {
      try {
        loadVoices();
        const u = new Utter(' ');
        u.volume = 0;
        synth.speak(u);
      } catch { /* ignore */ }
    }
    return unlocked;
  }

  return {
    unlock,
    setLang(l) { lang = l === 'en' ? 'en' : 'zh'; },
    setBleep(on) { bleepOn = !!on; },
    setBleepWords(list) { words = Array.isArray(list) ? list : DEFAULT_BLEEP_WORDS; },
    setVolume(v) { volume = clamp(Number(v) || 0, 0, 1); if (master) master.gain.value = volume; },
    /** Voice punch on/off (true / false) or tuning merged over VOICE_FX ({ punchRate: 1.04, impact: false }). */
    setVoiceFx(v) { fxCfg = v && typeof v === 'object' ? { ...(typeof fxCfg === 'object' ? fxCfg : {}), enabled: true, ...v } : !!v; },
    get voiceFx() { return fxConfig(fxCfg); },
    /** Lite mode (ui K4): the voice punch drops its compressor, shaper and megaphone filters. */
    setLite(on) { liteOn = !!on; },
    speak,
    playClerk,
    playCustomer,
    voiceTimings,
    cut,
    hush,
    duck,
    restore,
    bed,
    loop,
    stopLoop,
    stopLoops,
    announce,
    loadVoicePack,
    preloadVoice,
    hasClip: (text) => !!findClip(text),
    get hasVoicePack() { return !!pack; },
    sfx,
    crowd,
    stopSpeech,
    get canSpeak() { return !!(synth && Utter); },
    get canPlay() { return !!AC; },
    get unlocked() { return unlocked; },
  };
}
