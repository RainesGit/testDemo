"""build_voice.py — render the game's voice pack with Kokoro-82M (Apache-2.0), fully offline.

Usage (see tools/voice/README.md for setup):
  node tools/voice/export-lines.mjs > jobs.json
  python tools/voice/build_voice.py jobs.json --model kokoro-q8.onnx --voices voices.npz --out voice

Output:
  <out>/manifest.json      { version, sampleRate, langs: { zh|en: { chunks: [...], clips: { key: clip } } } }
  <out>/<lang>-<n>.mp3     audio sprites; clip = { c: chunk, o: offset s, d: duration s, b?: bleeped clip }
Clips are packed into ~60 s sprites so the game loads a handful of files instead of hundreds.
"""

import argparse
import json
import os
import sys

from multiprocessing import Pool

import lameenc
import numpy as np
import onnxruntime as ort
from kokoro_onnx import Kokoro

SR = 24000
GAP = int(0.12 * SR)          # silence between clips inside a sprite (absorbs mp3 decoder offset)
CHUNK_SECONDS = 60
BLEEP_HZ = 1000


def trim(audio, thresh=0.012, keep=int(0.03 * SR)):
    idx = np.flatnonzero(np.abs(audio) > thresh)
    if idx.size == 0:
        return audio[:0]
    return audio[max(0, idx[0] - keep): idx[-1] + keep]


def normalize(audio, peak=0.89):
    m = float(np.max(np.abs(audio))) if audio.size else 0.0
    return audio * (peak / m) if m > 1e-4 else audio


def bleep(chars):
    n = int(min(0.5, 0.14 + 0.07 * chars) * SR)
    t = np.arange(n) / SR
    tone = 0.5 * np.sin(2 * np.pi * BLEEP_HZ * t)
    ramp = min(120, n // 2)
    env = np.ones(n)
    env[:ramp] = np.linspace(0, 1, ramp)
    env[-ramp:] = np.linspace(1, 0, ramp)
    return (tone * env).astype(np.float32)


class Synth:
    def __init__(self, model, voices, threads=0):
        if threads:
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = threads
            opts.inter_op_num_threads = 1
            sess = ort.InferenceSession(model, sess_options=opts, providers=['CPUExecutionProvider'])
            self.k = Kokoro.from_session(sess, voices)
        else:
            self.k = Kokoro(model, voices)
        self.zh = None

    def say(self, lang, text, voice, speed):
        text = text.strip()
        if not text:
            return np.zeros(0, dtype=np.float32)
        if lang == 'zh':
            if self.zh is None:
                from misaki import zh
                self.zh = zh.ZHG2P()
            phonemes, _ = self.zh(text)
            if not phonemes.strip():
                return np.zeros(0, dtype=np.float32)
            audio, sr = self.k.create(phonemes, voice=voice, speed=speed, is_phonemes=True)
        else:
            audio, sr = self.k.create(text, voice=voice, speed=speed, lang='en-us')
        assert sr == SR, sr
        return trim(np.asarray(audio, dtype=np.float32))


def render(synth, job):
    main = normalize(synth.say(job['lang'], job['text'], job['voice'], job['speed']))
    bleeped = None
    if job.get('segments'):
        parts = []
        for seg in job['segments']:
            if seg['type'] == 'bleep':
                parts.append(bleep(len(seg['value'])))
            else:
                parts.append(normalize(synth.say(job['lang'], seg['value'], job['voice'], job['speed'])))
        bleeped = np.concatenate(parts) if parts else None
    return main, bleeped


_worker = None


def _init_worker(model, voices, threads):
    global _worker
    _worker = Synth(model, voices, threads)


def _render_job(job):
    return render(_worker, job)


class Packer:
    def __init__(self, out, lang):
        self.out, self.lang = out, lang
        self.chunks, self.buf, self.pos = [], [], 0

    def add(self, audio):
        if self.pos / SR > CHUNK_SECONDS:
            self.flush()
        self.buf.append(np.zeros(GAP, dtype=np.float32))
        self.pos += GAP
        clip = {'c': len(self.chunks), 'o': round(self.pos / SR, 4), 'd': round(len(audio) / SR, 4)}
        self.buf.append(audio)
        self.pos += len(audio)
        return clip

    def flush(self):
        if not self.buf:
            return
        pcm = np.concatenate(self.buf + [np.zeros(GAP, dtype=np.float32)])
        enc = lameenc.Encoder()
        enc.set_bit_rate(48)
        enc.set_in_sample_rate(SR)
        enc.set_channels(1)
        enc.set_quality(2)
        data = enc.encode((np.clip(pcm, -1, 1) * 32767).astype(np.int16).tobytes()) + enc.flush()
        name = f'{self.lang}-{len(self.chunks)}.mp3'
        with open(os.path.join(self.out, name), 'wb') as f:
            f.write(data)
        self.chunks.append(name)
        self.buf, self.pos = [], 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('jobs')
    ap.add_argument('--model', required=True)
    ap.add_argument('--voices', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--workers', type=int, default=os.cpu_count() or 1,
                    help='parallel single-threaded synthesis processes (default: CPU count)')
    args = ap.parse_args()

    jobs = json.load(open(args.jobs, encoding='utf-8'))
    os.makedirs(args.out, exist_ok=True)
    for f in os.listdir(args.out):
        if f.endswith('.mp3') or f == 'manifest.json':
            os.remove(os.path.join(args.out, f))

    pool = Pool(args.workers, initializer=_init_worker, initargs=(args.model, args.voices, 1))
    manifest = {'version': 1, 'sampleRate': SR, 'engine': 'Kokoro-82M v1.0 (Apache-2.0)', 'langs': {}}
    for lang in ('zh', 'en'):
        packer = Packer(args.out, lang)
        clips = {}
        todo = [j for j in jobs if j['lang'] == lang]
        rendered = pool.imap(_render_job, todo, chunksize=2)
        for i, (job, (main_audio, bleeped)) in enumerate(zip(todo, rendered), 1):
            if main_audio.size == 0:
                print(f'[skip] {lang} {job["key"]} empty: {job["text"]!r}', file=sys.stderr)
                continue
            clip = packer.add(main_audio)
            if bleeped is not None and bleeped.size:
                clip['b'] = packer.add(bleeped)
            clips[job['key']] = clip
            if i % 25 == 0 or i == len(todo):
                print(f'{lang}: {i}/{len(todo)}', file=sys.stderr, flush=True)
        packer.flush()
        manifest['langs'][lang] = {'chunks': packer.chunks, 'clips': clips}

    pool.close()
    with open(os.path.join(args.out, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(',', ':'))
    total = sum(os.path.getsize(os.path.join(args.out, n)) for n in os.listdir(args.out))
    print(f'done: {sum(len(v["clips"]) for v in manifest["langs"].values())} clips, {total / 1e6:.1f} MB', file=sys.stderr)


if __name__ == '__main__':
    main()
