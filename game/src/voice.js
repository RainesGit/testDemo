// voice.js — 吼罵模式 (voice mode, docs/gameplay-v2.md 10): pure loudness analysis of the player's own voice.
// No DOM, no WebAudio: src/mic.js feeds it dBFS frames from an AnalyserNode; everything here is unit-tested in
// test/voice.test.mjs. Nothing is recorded, stored or sent anywhere by this module.
//
//   levelFrom(samples) → dBFS (RMS of a Float32Array of -1..1 samples; silence → VOICE.minDb)
//   tuningFor({ whisper }) → { onsetDb, scoldDb, roarDb, ... } (whisper = 小聲模式: lower thresholds)
//   loudness(db, floor, tuning) → -1 (nothing) | 0 說 (talk) | 1 罵 (scold) | 2 吼 (roar)   == the answer's charge
//   createCalibrator() → { feed(db), floor(), frames }   the room's noise floor (a low percentile of ~1 s of frames)
//   createShoutDetector({ floor, whisper, tuning }) → { feed(db, t) → events[], resetPhrase(), setFloor(), ... }
//     events (t in ms, db in dBFS):
//       onset   { t, db, level }                   level > floor + onsetDb for ≥ onsetMs (t = where the run began)
//       rise    { t, db, level }                   the segment reached a louder level (1 罵 answers, 2 吼 charges)
//       sustain { t, level, n }                    every sustainMs of continuous ≥ 罵 voice (rage sweeps)
//       peak    { t, db, level, softMs, softDb, contrast, punchT }   once per segment that reached ≥ 罵: the level
//                                                  fell peakDropDb below its maximum, or the segment ended
//       end     { t, startT, durationMs, peakDb, peakLevel }
//     The phrase (resetPhrase() at each new customer) remembers the soft 說-level voice before the shout, across
//     pauses: the polite setup → pause → shout of the three beats. contrast = shout peak − setup average.
//   contrast(quietDb, loudDb) → whole dB (≥ 0)
//   contrastBonus(phrase, peak, tuning) → true when the setup was soft for ≥ softMinMs and the punch reached 吼
//   splText(dbfs) → a playful "分貝級" number for the summary card (dBFS + 110, uncalibrated)
//   keywordKey(text) → { key: 'gun'|'shut'|'take'|null, jackpot } from recognized words (optional keyword mode)

export const VOICE = {
  minDb: -100,        // silence floor of levelFrom()
  onsetDb: 12,        // 說: voice starts this far above the room's noise floor
  scoldDb: 22,        // 罵: answers the customer
  roarDb: 30,         // 吼: charge 2, the contrast punch
  onsetMs: 120,       // the voice must stay above the onset level this long to count (no clicks, no coughs)
  releaseMs: 200,     // below the onset level (minus hysteresis) this long ends the segment (syllable gaps survive)
  hysteresisDb: 3,
  peakDropDb: 4,      // the peak is called once the level falls this far below the segment's maximum
  sustainMs: 300,     // rage: every 300 ms of sustained 罵 (or louder) voice sends a head flying
  softMinMs: 300,     // contrast: at least this much soft 說-level voice before the shout
  attack: 0.6,        // smoothing of the dB track (rising / falling)
  release: 0.3,
  floorMin: -72,      // the noise floor is kept between these (a dead-silent fake device, a loud MRT car)
  floorMax: -32,
  whisper: { onsetDb: 7, scoldDb: 13, roarDb: 19 }, // 小聲模式 (quiet places): softer is enough
};

/** Root-mean-square level of a block of samples in dBFS. */
export function levelFrom(samples) {
  const n = samples ? samples.length : 0;
  if (!n) return VOICE.minDb;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / n);
  if (!(rms > 0)) return VOICE.minDb;
  return Math.max(VOICE.minDb, 20 * Math.log10(rms));
}

export function tuningFor({ whisper = false, tuning } = {}) {
  return { ...VOICE, ...(whisper ? VOICE.whisper : {}), ...(tuning || {}) };
}

/** -1 below the onset level, 0 說, 1 罵, 2 吼. */
export function loudness(db, floor, tuning = VOICE) {
  const d = db - floor;
  if (d >= tuning.roarDb) return 2;
  if (d >= tuning.scoldDb) return 1;
  if (d >= tuning.onsetDb) return 0;
  return -1;
}

export const contrast = (quietDb, loudDb) => (Number.isFinite(quietDb) && Number.isFinite(loudDb) ? Math.max(0, Math.round(loudDb - quietDb)) : 0);

export const clampFloor = (db, tuning = VOICE) => Math.min(tuning.floorMax, Math.max(tuning.floorMin, Number.isFinite(db) ? db : tuning.floorMin));

/** The room's noise floor from about a second of frames: the 20th percentile (a cough or a bang does not lift it). */
export function createCalibrator(tuning = VOICE) {
  const frames = [];
  return {
    feed(db) { if (Number.isFinite(db)) frames.push(db); },
    get frames() { return frames.length; },
    floor() {
      if (!frames.length) return clampFloor(-60, tuning);
      const s = [...frames].sort((a, b) => a - b);
      return clampFloor(s[Math.floor((s.length - 1) * 0.2)], tuning);
    },
  };
}

export function contrastBonus(phrase, peak, tuning = VOICE) {
  return !!(phrase && peak && phrase.softMs >= tuning.softMinMs && peak.level >= 2);
}

/** "今日最大聲：98 分貝級": dBFS + 110, a playful scale (the mic is not calibrated). */
export const splText = (dbfs) => Math.round(Math.min(130, Math.max(40, (Number(dbfs) || VOICE.minDb) + 110)));

const KEYWORDS = [
  { key: 'jackpot', re: /二百五|二百五十|250|two\s*fifty|two\s*hundred\s*(and\s*)?fifty/i },
  { key: 'gun', re: /滾|滾|scram|get\s*out|beat\s*it/i },
  { key: 'shut', re: /閉嘴|閉嘴|shut\s*up|zip\s*it|shut\s*it/i },
  { key: 'take', re: /收|兩個月|兩個月|二個月|two\s*months|booked|deal/i },
];
/** Recognized speech → the key it names (閉嘴 before 收 in "閉嘴收" order does not matter: first in the text wins). */
export function keywordKey(text) {
  const s = String(text ?? '');
  const jackpot = KEYWORDS[0].re.test(s);
  let best = null;
  let at = Infinity;
  for (const { key, re } of KEYWORDS.slice(1)) {
    const m = s.match(re);
    if (m && m.index < at) { at = m.index; best = key; }
  }
  return { key: best, jackpot };
}

/**
 * Streaming shout detector. feed(db, t) once per analysis frame (about every 20 ms) with the raw dBFS of the frame;
 * it smooths the track, follows the noise floor between segments, and returns the events of this frame.
 */
export function createShoutDetector({ floor = -60, whisper = false, tuning } = {}) {
  let tn = tuningFor({ whisper, tuning });
  let fl = clampFloor(floor, tn);
  let sm = null;      // smoothed dB
  let lastT = null;
  let run = null;     // { t } frames above onset that are not yet a segment (onsetMs not reached)
  let seg = null;     // the current voice segment
  let below = 0;      // ms below the release level inside a segment
  let phrase = { softMs: 0, softSum: 0 };

  const lvl = (db) => loudness(db, fl, tn);

  function endSegment(t, out) {
    if (seg.maxLevel >= 1 && !seg.peaked) out.push(peakEvent(t));
    out.push({ type: 'end', t, startT: seg.startT, durationMs: Math.max(0, t - seg.startT), peakDb: seg.maxDb, peakLevel: seg.maxLevel });
    seg = null;
    below = 0;
  }
  function peakEvent(t) {
    seg.peaked = true;
    const softDb = phrase.softMs > 0 ? phrase.softSum / phrase.softMs : null;
    return {
      type: 'peak', t, db: seg.maxDb, level: seg.maxLevel, punchT: seg.punchT ?? seg.startT,
      softMs: Math.round(phrase.softMs), softDb, contrast: softDb == null ? 0 : contrast(softDb, seg.maxDb),
    };
  }

  return {
    feed(db, t) {
      const out = [];
      const raw = Number.isFinite(db) ? Math.max(VOICE.minDb, db) : VOICE.minDb;
      sm = sm == null ? raw : sm + (raw - sm) * (raw > sm ? tn.attack : tn.release);
      const dt = lastT == null ? 0 : Math.max(0, Math.min(100, t - lastT));
      lastT = t;
      const level = lvl(sm);
      if (!seg) {
        if (level >= 0) {
          if (!run) run = { t: t - dt, softMs: 0, softSum: 0 };
          if (level === 0) { run.softMs += dt; run.softSum += sm * dt; }
          if (t - run.t >= tn.onsetMs) {
            seg = { startT: run.t, maxDb: sm, maxLevel: level, peaked: false, sustain: 0, sustainN: 0, punchT: level >= 1 ? t : null };
            phrase.softMs += run.softMs;
            phrase.softSum += run.softSum;
            run = null;
            below = 0;
            out.push({ type: 'onset', t: seg.startT, db: sm, level });
            if (level >= 1) out.push({ type: 'rise', t, db: sm, level });
          }
        } else {
          run = null;
          // follow the room between segments: down quickly, up slowly (only from near-floor frames)
          if (sm < fl) fl = clampFloor(fl + (sm - fl) * 0.05, tn);
          else if (sm < fl + tn.onsetDb - tn.hysteresisDb) fl = clampFloor(fl + (sm - fl) * 0.002, tn);
        }
        return out;
      }
      // inside a segment
      if (level === 0 && seg.maxLevel < 1) { phrase.softMs += dt; phrase.softSum += sm * dt; }
      if (level > seg.maxLevel) {
        seg.maxLevel = level;
        if (level >= 1 && seg.punchT == null) seg.punchT = t;
        out.push({ type: 'rise', t, db: sm, level });
      }
      if (sm > seg.maxDb) seg.maxDb = sm;
      if (level >= 1) {
        seg.sustain += dt;
        while (seg.sustain >= tn.sustainMs) {
          seg.sustain -= tn.sustainMs;
          seg.sustainN += 1;
          out.push({ type: 'sustain', t, level, n: seg.sustainN });
        }
      } else seg.sustain = 0;
      if (!seg.peaked && seg.maxLevel >= 1 && sm <= seg.maxDb - tn.peakDropDb) out.push(peakEvent(t));
      if (sm - fl < tn.onsetDb - tn.hysteresisDb) {
        below += dt;
        if (below >= tn.releaseMs) endSegment(t, out);
      } else below = 0;
      return out;
    },
    /** A new answer window: forget the soft setup voice of the last one. */
    resetPhrase() { phrase = { softMs: 0, softSum: 0 }; },
    get phrase() { return { softMs: Math.round(phrase.softMs), softDb: phrase.softMs > 0 ? phrase.softSum / phrase.softMs : null }; },
    setFloor(db) { fl = clampFloor(db, tn); },
    setWhisper(on) { tn = tuningFor({ whisper: on, tuning }); fl = clampFloor(fl, tn); },
    get floor() { return fl; },
    get db() { return sm == null ? VOICE.minDb : sm; },
    get level() { return sm == null ? -1 : lvl(sm); },
    get active() { return !!seg; },
    get tuning() { return tn; },
    /** Drop the current segment without events (the game's own replay is playing: never hear yourself). */
    mute() { seg = null; run = null; below = 0; },
  };
}
