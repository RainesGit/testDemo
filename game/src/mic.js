// mic.js — 吼罵模式 (voice mode, docs/gameplay-v2.md 10): the microphone, local only.
// getUserMedia (echo cancellation on; noise suppression and auto gain off so loud stays loud) → AnalyserNode, polled
// every frameMs into onFrame(dBFS, performance.now()) (src/voice.js analyses it), plus a rolling ringSec-second buffer
// of the raw samples (ScriptProcessor; no AudioWorklet module file needed) so the game can replay the player's own
// shout through the shop megaphone right after it. The samples never leave this page: no upload, no MediaRecorder
// file, no storage. stop() releases the microphone (the browser's recording indicator goes off).
//
// createMic({ getContext, onFrame, frameMs = 20, ringSec = 3 }) → mic
//   start() → Promise<{ ok, reason? }>   reason: 'unavailable' | 'denied' | 'error'
//   stop()
//   clip(fromMs, toMs) → AudioBuffer | null   (performance.now() times inside the last ringSec seconds)
//   active, canRecord
import { levelFrom } from './voice.js';

export function createMic({ getContext, onFrame = () => {}, frameMs = 20, ringSec = 3 } = {}) {
  let stream = null;
  let src = null;
  let analyser = null;
  let proc = null;
  let sink = null;
  let timer = 0;
  let ring = null;
  let ringPos = 0;    // next write index
  let ringFill = 0;
  let lastWriteAt = 0; // performance.now() of the end of the last written block
  let ctx = null;
  let buf = null;

  async function start() {
    if (stream) return { ok: true };
    const md = globalThis.navigator && navigator.mediaDevices;
    if (!md || typeof md.getUserMedia !== 'function') return { ok: false, reason: 'unavailable' };
    ctx = getContext && getContext();
    if (!ctx) return { ok: false, reason: 'unavailable' };
    try {
      stream = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
    } catch (err) {
      stream = null;
      const name = err && err.name;
      return { ok: false, reason: name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'unavailable' : 'error' };
    }
    try {
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0;
      src.connect(analyser);
      buf = new Float32Array(analyser.fftSize);
      if (typeof ctx.createScriptProcessor === 'function') {
        ring = new Float32Array(Math.ceil(ctx.sampleRate * ringSec));
        proc = ctx.createScriptProcessor(2048, 1, 1);
        proc.onaudioprocess = (e) => {
          const d = e.inputBuffer.getChannelData(0);
          for (let i = 0; i < d.length; i++) { ring[ringPos] = d[i]; ringPos = (ringPos + 1) % ring.length; }
          ringFill = Math.min(ring.length, ringFill + d.length);
          lastWriteAt = performance.now();
        };
        // a ScriptProcessor only runs while connected to the output: through a muted gain (the mic is never heard live)
        sink = ctx.createGain();
        sink.gain.value = 0;
        src.connect(proc);
        proc.connect(sink);
        sink.connect(ctx.destination);
      }
      timer = setInterval(() => {
        if (!analyser) return;
        if (analyser.getFloatTimeDomainData) analyser.getFloatTimeDomainData(buf);
        onFrame(levelFrom(buf), performance.now());
      }, frameMs);
      return { ok: true };
    } catch {
      stop();
      return { ok: false, reason: 'error' };
    }
  }

  function stop() {
    clearInterval(timer);
    timer = 0;
    for (const n of [src, analyser, proc, sink]) { try { n && n.disconnect(); } catch { /* gone */ } }
    if (proc) proc.onaudioprocess = null;
    src = analyser = proc = sink = null;
    if (stream) { try { stream.getTracks().forEach((t) => t.stop()); } catch { /* gone */ } }
    stream = null;
    ring = null;
    ringFill = 0;
  }

  /** The samples between two performance.now() times (inside the rolling buffer) as a new AudioBuffer. */
  function clip(fromMs, toMs) {
    if (!ring || !ctx || !ringFill) return null;
    const sr = ctx.sampleRate;
    const backFrom = Math.round(((lastWriteAt - fromMs) / 1000) * sr);
    const backTo = Math.max(0, Math.round(((lastWriteAt - toMs) / 1000) * sr));
    const n = Math.min(ringFill, backFrom) - backTo;
    if (!(n > sr * 0.05)) return null;
    const out = ctx.createBuffer(1, n, sr);
    const data = out.getChannelData(0);
    let p = (ringPos - backTo - n + ring.length * 2) % ring.length;
    for (let i = 0; i < n; i++) { data[i] = ring[p]; p = (p + 1) % ring.length; }
    return out;
  }

  return {
    start, stop, clip,
    get active() { return !!stream; },
    get canRecord() { return !!ring; },
  };
}
