// 《来250杯！》/ "250 Cups!" — audio module.
// All SFX are synthesized with WebAudio (no external audio files, zero copyright risk).
// Speech uses the Web Speech API (speechSynthesis). Everything degrades silently when
// the browser lacks support. Nothing makes sound until unlock() runs inside a user gesture.
//
// Pure helpers (stripStage, splitForBleep, styleParams, chuuniSplit, buildSpeechPlan)
// have no DOM/audio dependency and are unit-tested in test/audio.test.mjs.

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
  'your mom', 'yo mama', 'motherfucker', 'fucking', 'fuck', 'shit', 'damn', 'hell', 'bitch',
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
  real:    { rate: 1.15, pitch: 1.0 },
  curse:   { rate: 1.5,  pitch: 1.35 },
  disdain: { rate: 0.95, pitch: 0.8 },
  cold:    { rate: 0.72, pitch: 0.55 },
  deadpan: { rate: 1.0,  pitch: 0.9 },
  chuuni:  { rate: 1.45, pitch: 1.25, slowRate: 0.7, slowPitch: 1.1 },
  math:    { rate: 1.3,  pitch: 1.05 },
  '250':   { rate: 1.35, pitch: 1.2 },
  twist:   { rate: 1.2,  pitch: 1.1 },
  polite:  { rate: 1.0,  pitch: 1.6 },  // forced service voice "您好～😊"
  cust:    { rate: 1.05, pitch: 1.15 }, // customer lines
  boo:     { rate: 1.1,  pitch: 0.7 },
  rage:    { rate: 1.7,  pitch: 1.4 },
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
    if (style === 'chuuni' && rate == null) {
      const base = STYLE_VOICE.chuuni;
      const [slow, fast] = chuuniSplit(t);
      const out = [{ type: 'say', text: slow, rate: base.slowRate, pitch: pitch ?? base.slowPitch }];
      if (fast) out.push({ type: 'say', text: fast, rate: p.rate, pitch: p.pitch });
      return out;
    }
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

export function createAudio({ bleepWords = DEFAULT_BLEEP_WORDS, volume = 0.85 } = {}) {
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
    // Counter slam: low thud dropping in pitch + short filtered noise crack.
    slam(t, o) {
      const k = o.intensity ?? 1;
      const g1 = gain(master);
      const end = env(g1, t, { a: 0.003, peak: 1.0 * k, d: 0.28 });
      const thud = osc('sine', 150, t, end, g1);
      thud.frequency.exponentialRampToValueAtTime(38, t + 0.22);
      const g2 = gain(master);
      const e2 = env(g2, t, { a: 0.001, peak: 0.7 * k, d: 0.12 });
      noise(t, e2, filter('lowpass', 1400, 0.7, g2));
      const g3 = gain(master);
      const e3 = env(g3, t, { a: 0.001, peak: 0.35 * k, d: 0.03 });
      osc('square', 90, t, e3, g3);
      return end;
    },
    // Customer flung away: bandpass noise sweep + cartoon slide whistle.
    whoosh(t, o) {
      const dur = o.duration ?? 0.42;
      const g1 = gain(master);
      g1.gain.setValueAtTime(0.0001, t);
      g1.gain.exponentialRampToValueAtTime(0.9, t + dur * 0.4);
      g1.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const bp = filter('bandpass', 250, 2.2, g1);
      bp.frequency.setValueAtTime(250, t);
      bp.frequency.exponentialRampToValueAtTime(4500, t + dur);
      noise(t, t + dur, bp);
      const g2 = gain(master);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const w = osc('sine', 500, t, t + dur, g2);
      w.frequency.exponentialRampToValueAtTime(2200, t + dur);
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
    // Order-number bell.
    ding(t, o) {
      const f = o.freq ?? 1567.98;
      let end = t;
      [[1, 0.5, 0.9], [2.76, 0.18, 0.5], [5.4, 0.07, 0.25]].forEach(([mul, pk, d]) => {
        const gg = gain(master);
        end = Math.max(end, env(gg, t, { a: 0.002, peak: pk, d }));
        osc('sine', f * mul, t, t + d + 0.01, gg);
      });
      return end;
    },
    // Button press: tiny bubbly pop.
    pop(t) {
      const gg = gain(master);
      const end = env(gg, t, { a: 0.002, peak: 0.45, d: 0.07 });
      const s = osc('sine', 900, t, end, gg);
      s.frequency.exponentialRampToValueAtTime(220, t + 0.07);
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
  function buildCrowd() {
    const out = gain(master, 0);
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

  async function speak(text, opts = {}) {
    if (!unlocked) return;
    const plan = buildSpeechPlan(text, { ...opts, bleep: bleepOn, words });
    if (!plan.length) return;
    const gen = speechGen;
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

  function stopSpeech() {
    speechGen++;
    try { synth?.cancel(); } catch { /* ignore */ }
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
    speak,
    sfx,
    crowd,
    stopSpeech,
    get canSpeak() { return !!(synth && Utter); },
    get canPlay() { return !!AC; },
    get unlocked() { return unlocked; },
  };
}
