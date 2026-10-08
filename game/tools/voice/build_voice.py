"""build_voice.py — render the game's voice pack with Kokoro-82M (Apache-2.0), fully offline.

Usage (see tools/voice/README.md for setup):
  node tools/voice/export-lines.mjs [--punchy] > jobs.json
  python tools/voice/build_voice.py jobs.json --model kokoro-q8.onnx --voices voices.npz --out voice

Per-segment render settings come from the jobs: each job carries its own Kokoro `speed`, and an optional
`post` ({ gainDb, ceiling }, written by export-lines.mjs --punchy for the hit halves and rage lines) that is
applied after normalizing: +gainDb, then a peak limiter (1 ms attack, 80 ms release) at `ceiling`.

Output:
  <out>/manifest.json      { version, sampleRate, langs: { zh|en: { chunks: [...], clips: { key: clip } } } }
  <out>/<lang>-<n>.mp3     audio sprites; clip = { c: chunk, o: offset s, d: duration s, h: job hash, b?: bleeped clip }
Clips are packed into ~60 s sprites so the game loads a handful of files instead of hundreds.

Chinese: the game's text is Traditional Chinese (Taiwan) at the source and clip keys are computed from it, but the
Kokoro / misaki G2P is trained on Simplified text, so zh jobs are converted with OpenCC t2s (Traditional ->
Simplified) right before G2P. Only the TTS input changes; keys, job hashes and the manifest stay Traditional.
Needs: pip install opencc-python-reimplemented (or the `opencc` package).
"""

import argparse
import hashlib
import json
import os
import sys

from multiprocessing import Pool

import lameenc
import numpy as np
import onnxruntime as ort
from kokoro_onnx import Kokoro

try:
    import opencc
    _T2S = opencc.OpenCC('t2s')
except ImportError:  # pragma: no cover
    _T2S = None


def zh_tts_input(text):
    """Traditional (display / key text) -> Simplified for the Mandarin G2P. TTS input only."""
    if _T2S is None:
        sys.exit('build_voice.py: Chinese lines need OpenCC (pip install opencc-python-reimplemented)')
    # OpenCC keeps 著 after verbs (站著, 坐著, 排著), which the G2P reads zhù; every 著 in the game is the
    # aspect particle, so it goes to 着 (zhe), as in the old Simplified source.
    return _T2S.convert(text).replace('著', '着')

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


def limit(audio, ceiling=0.95, attack=int(0.001 * SR), release_s=0.08):
    """Peak limiter: gain = min(1, ceiling / peak) over a short look-ahead window, instant attack, smooth
    release, then a hard safety clip at the ceiling."""
    if audio.size == 0:
        return audio
    a = np.abs(audio)
    # look-ahead peak over `attack` samples (max filter)
    win = max(1, attack)
    padded = np.concatenate([a, np.zeros(win, dtype=a.dtype)])
    peak = np.max(np.lib.stride_tricks.sliding_window_view(padded, win + 1), axis=1)[: a.size]
    target = np.minimum(1.0, ceiling / np.maximum(peak, 1e-6))
    coef = np.exp(-1.0 / (release_s * SR))
    gain = np.empty_like(target)
    g = 1.0
    for i, t in enumerate(target):  # ~20 ms per second of audio
        g = t if t < g else t + (g - t) * coef
        gain[i] = g
    return np.clip(audio * gain, -ceiling, ceiling).astype(np.float32)


def post_process(audio, post):
    """Per-segment post (job['post']): +gainDb into the limiter. Makes a hit denser and louder."""
    if not post or audio.size == 0:
        return audio
    gain = 10 ** (float(post.get('gainDb', 0)) / 20)
    return limit(audio * gain, float(post.get('ceiling', 0.95)))


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

    def say(self, lang, text, voice, speed, keep=None):
        text = text.strip()
        if not text:
            return np.zeros(0, dtype=np.float32)
        if lang == 'zh':
            if self.zh is None:
                from misaki import zh
                self.zh = zh.ZHG2P()
            phonemes, _ = self.zh(zh_tts_input(text))
            if not phonemes.strip():
                return np.zeros(0, dtype=np.float32)
            audio, sr = self.k.create(phonemes, voice=voice, speed=speed, is_phonemes=True)
        else:
            audio, sr = self.k.create(text, voice=voice, speed=speed, lang='en-us')
        assert sr == SR, sr
        audio = np.asarray(audio, dtype=np.float32)
        return trim(audio) if keep is None else trim(audio, keep=keep)


# Setup halves of '|' lines keep a 40 ms tail so the program-inserted silence does not clip the last
# syllable (spec K2); everything else keeps the default 30 ms.
def _keep(job):
    return int(0.04 * SR) if job.get('part') == 'setup' else None


def job_hash(job):
    # What was rendered: changes to the TTS text (e.g. 250 -> 二百五十), speed or voice re-render the clip
    # in --incremental mode even though the key (display text) stays the same.
    src = '|'.join(str(job.get(k, '')) for k in ('text', 'speed', 'voice', 'part'))
    if job.get('post'):  # only when present, so hashes of packs built without post stay valid
        src += '|' + json.dumps(job['post'], sort_keys=True)
    return hashlib.sha1(src.encode('utf-8')).hexdigest()[:8]


def render(synth, job):
    keep = _keep(job)
    post = job.get('post')
    main = post_process(normalize(synth.say(job['lang'], job['text'], job['voice'], job['speed'], keep)), post)
    bleeped = None
    if job.get('segments'):
        parts = []
        for seg in job['segments']:
            if seg['type'] == 'bleep':
                parts.append(bleep(len(seg['value'])))
            else:
                parts.append(post_process(normalize(synth.say(job['lang'], seg['value'], job['voice'], job['speed'], keep)), post))
        bleeped = np.concatenate(parts) if parts else None
    return main, bleeped


_worker = None


def _init_worker(model, voices, threads):
    global _worker
    _worker = Synth(model, voices, threads)


def _render_job(job):
    return render(_worker, job)


class Packer:
    def __init__(self, out, lang, base=0):
        self.out, self.lang, self.base = out, lang, base
        self.chunks, self.buf, self.pos = [], [], 0

    def add(self, audio):
        if self.pos / SR > CHUNK_SECONDS:
            self.flush()
        self.buf.append(np.zeros(GAP, dtype=np.float32))
        self.pos += GAP
        clip = {'c': self.base + len(self.chunks), 'o': round(self.pos / SR, 4), 'd': round(len(audio) / SR, 4)}
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
        name = f'{self.lang}-{self.base + len(self.chunks)}.mp3'
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
    ap.add_argument('--incremental', action='store_true',
                    help='keep clips already in <out>/manifest.json, render only new or changed lines into new sprites')
    args = ap.parse_args()

    jobs = json.load(open(args.jobs, encoding='utf-8'))
    os.makedirs(args.out, exist_ok=True)
    if _T2S is None and any(j['lang'] == 'zh' for j in jobs):
        sys.exit('build_voice.py: Chinese lines need OpenCC (pip install opencc-python-reimplemented)')
    old = {}
    manifest_path = os.path.join(args.out, 'manifest.json')
    if args.incremental and os.path.exists(manifest_path):
        old = json.load(open(manifest_path, encoding='utf-8')).get('langs', {})
    else:
        for f in os.listdir(args.out):
            if f.endswith('.mp3') or f == 'manifest.json':
                os.remove(os.path.join(args.out, f))

    pool = Pool(args.workers, initializer=_init_worker, initargs=(args.model, args.voices, 1))
    manifest = {'version': 1, 'sampleRate': SR, 'engine': 'Kokoro-82M v1.0 (Apache-2.0)', 'langs': {}}
    for lang in ('zh', 'en'):
        prev = old.get(lang, {'chunks': [], 'clips': {}})
        wanted = [j for j in jobs if j['lang'] == lang]
        # Keep clips whose line and rendering inputs are unchanged (same key and same job hash 'h');
        # lines that no longer exist drop out of the manifest.
        clips = {j['key']: prev['clips'][j['key']] for j in wanted
                 if j['key'] in prev['clips'] and prev['clips'][j['key']].get('h') == job_hash(j)}
        todo = [j for j in wanted if j['key'] not in clips]
        packer = Packer(args.out, lang, base=len(prev['chunks']))
        print(f'{lang}: {len(clips)} kept, {len(todo)} to render', file=sys.stderr, flush=True)
        rendered = pool.imap(_render_job, todo, chunksize=2)
        for i, (job, (main_audio, bleeped)) in enumerate(zip(todo, rendered), 1):
            if main_audio.size == 0:
                print(f'[skip] {lang} {job["key"]} empty: {job["text"]!r}', file=sys.stderr)
                continue
            clip = packer.add(main_audio)
            clip['h'] = job_hash(job)
            if bleeped is not None and bleeped.size:
                clip['b'] = packer.add(bleeped)
            clips[job['key']] = clip
            if i % 25 == 0 or i == len(todo):
                print(f'{lang}: {i}/{len(todo)}', file=sys.stderr, flush=True)
        packer.flush()
        manifest['langs'][lang] = {'chunks': prev['chunks'] + packer.chunks, 'clips': clips}

    pool.close()
    with open(os.path.join(args.out, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(',', ':'))
    total = sum(os.path.getsize(os.path.join(args.out, n)) for n in os.listdir(args.out))
    print(f'done: {sum(len(v["clips"]) for v in manifest["langs"].values())} clips, {total / 1e6:.1f} MB', file=sys.stderr)


if __name__ == '__main__':
    main()
