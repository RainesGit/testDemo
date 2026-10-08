// voice-wav.mjs — synthesizes the fake microphone input for tools/check-voice.mjs (吼罵模式, docs/gameplay-v2.md 10).
// A voice-like signal (180 Hz buzz with harmonics, a 5 Hz syllable wobble and breath noise) in a loop Chrome plays as the
// microphone (--use-file-for-fake-audio-capture loops the file):
//   1.0 s room noise (-62 dBFS) → 0.5 s soft "setup" (about -44 dBFS: 說) → 0.2 s pause → 0.5 s loud "shout"
//   (about -12 dBFS: 吼) → 1.0 s room → 1.2 s long shout (about -16 dBFS: rage sweeps) → 0.8 s room
// Usage: node tools/voice-wav.mjs [out.wav]   (or import { writeVoiceWav } from './voice-wav.mjs')
import { writeFileSync } from 'node:fs';

const SR = 48000;
export const PLAN = [
  ['room', 1.0], ['soft', 0.5], ['room', 0.2], ['shout', 0.5], ['room', 1.0], ['long', 1.2], ['room', 0.8],
];
const LEVEL = { room: -62, soft: -44, shout: -12, long: -16 }; // target RMS in dBFS

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1; };
}

export function voiceSamples(plan = PLAN) {
  const rand = rng(250);
  const parts = [];
  for (const [kind, sec] of plan) {
    const n = Math.round(sec * SR);
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      if (kind === 'room') { buf[i] = rand(); continue; }
      const f0 = kind === 'soft' ? 170 : 210;
      let v = 0;
      for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * f0 * h * t) / h;
      const wobble = 0.75 + 0.25 * Math.sin(2 * Math.PI * 5 * t);
      const edge = Math.min(1, i / (0.02 * SR), (n - i) / (0.02 * SR)); // 20 ms fades
      buf[i] = (v * wobble + 0.25 * rand()) * edge;
    }
    // scale to the target RMS
    let sum = 0;
    for (let i = 0; i < n; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / n) || 1;
    const k = Math.pow(10, LEVEL[kind] / 20) / rms;
    for (let i = 0; i < n; i++) buf[i] = Math.max(-1, Math.min(1, buf[i] * k));
    parts.push(buf);
  }
  const total = parts.reduce((a, b) => a + b.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function wavBytes(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

export function writeVoiceWav(path) {
  writeFileSync(path, wavBytes(voiceSamples()));
  return path;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const p = writeVoiceWav(process.argv[2] || 'voice-test.wav');
  console.log(`wrote ${p} (${PLAN.reduce((a, [, s]) => a + s, 0).toFixed(1)} s loop)`);
}
