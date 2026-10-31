"""build_openai.py — render the game's voice pack with the OpenAI speech API (an expressive, directable AI voice).

Kokoro (build_voice.py) reads every line flat: it has no emotion control, so the clerk's polite → sudden curse →
instantly professional contrast cannot be acted. The OpenAI speech models take an acting direction per line
(`instructions`), so each line is rendered with a direction built from its role, delivery style and half
(the polite setup before '|', the hit after it). Same jobs, same keys, same manifest and sprite format as
build_voice.py: the game needs no change. The manifest is marked `expressive: true`, and src/audio.js then drops
the runtime crutches made for Kokoro (intonation contours, the faster hit, heavy drive).

Usage (from game/; needs network access to the API host and an API key in the environment):
  pip install numpy lameenc
  export OPENAI_API_KEY=...            # never commit it, never print it
  node tools/voice/export-lines.mjs > /tmp/voice-jobs.json
  # 1) listening samples first (a fixed set of ~24 lines → wav files, the pack is not touched)
  python3 tools/voice/build_openai.py /tmp/voice-jobs.json --sample /tmp/voice-sample
  # 2) the whole pack (~1100 lines, ~21 000 characters); cached, so a rerun only pays for new or changed lines
  python3 tools/voice/build_openai.py /tmp/voice-jobs.json --out voice

Options: --model (default gpt-4o-mini-tts), --workers (parallel requests, default 4), --lang zh|en (only one language;
the other keeps its current clips), --cast cast.json (override the voice casting), --base-url (another endpoint with
the same API, e.g. a proxy), --cache (raw responses, default tools/voice/.cache-openai/, gitignored).

Bleep words: like build_voice.py, a line with bleep words also gets a bleeped rendering (TTS segments + a 1 kHz tone).
Licensing: check the provider's current terms before release (generated audio for commercial use; telling players the
voices are AI-generated); record the model and date in docs/audio-sourcing.md.
"""

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_voice import SR, Packer, bleep, normalize, post_process, trim, _keep  # noqa: E402

# ---- casting: the Kokoro voice in each job → an OpenAI voice (override with --cast) ----
CAST = {
    # clerk (zh / en): a young man with a sharp tongue
    'zm_yunjian': 'ash', 'am_fenrir': 'ash',
    # customers zh (rotated by id in export-lines.mjs) and the opening's routine customers
    'zf_xiaobei': 'coral', 'zm_yunxi': 'echo', 'zf_xiaoni': 'shimmer', 'zm_yunyang': 'ballad', 'zf_xiaoyi': 'nova',
    'zm_yunxia': 'verse',
    # customers en
    'af_heart': 'coral', 'am_puck': 'verse', 'af_bella': 'shimmer', 'am_echo': 'echo', 'bf_emma': 'fable',
    'am_adam': 'onyx', 'af_sarah': 'nova', 'bm_george': 'ballad',
    # milestone announcer
    'zf_xiaoxiao': 'sage', 'af_nova': 'sage',
}

# ---- acting directions ----
LANG_NOTE = {
    'zh': 'Speak natural, casual Taiwanese Mandarin (台灣華語) with a Taiwanese accent, like a real person in Taipei. '
          'Read the Traditional Chinese text exactly as written; do not add or drop words.',
    'en': 'Speak natural, casual American English. Read the text exactly as written; do not add or drop words.',
}
GAME_NOTE = 'This is a comedy mobile game: keep it playful and punchy, never genuinely threatening. Short line, no long pauses.'
CLERK = 'You are a young bubble-tea shop clerk with a sharp tongue and perfect comic timing.'
CLERK_STYLE = {
    'polite': 'Overly sweet customer-service voice: bright, sing-song, a slightly fake smile you can hear.',
    'curse': 'Snap: a sudden explosive yell, completely fed up, sharp attack, loud and short, like finally losing it at a customer.',
    'rage': 'Full rage: shouting fast and loud, out of patience, words tumbling out.',
    'deadpan': 'Deadpan: flat, bored and unimpressed, dry comic timing, a tiny pause before the last word.',
    'cold': 'Cold and curt: clipped, dismissive, no warmth at all.',
    'disdain': 'Sneering and condescending, a little eye-roll in the voice.',
    'math': 'Fast and matter-of-fact, like doing the math out loud to prove a point, smug.',
    'chuuni': 'Over-the-top theatrical anime-hero delivery, dramatic and grand.',
    '250': 'Slow and deadpan, savouring the insult; the number lands like a verdict.',
    'twist': 'Starts as if agreeing, then turns it into a jab; a sly grin in the voice.',
    'real': 'Honest, a little tired and blunt, like talking to a friend who annoys you.',
    'next': 'Brisk: already moving on, calling the next customer.',
}
HALF = {
    'setup': 'This is the set-up half of the line: polite and professional on the surface, holding back.',
    'punch': 'This is the punchline half: the polite mask drops and it hits hard.',
}
CUSTOMER = ('You are an everyday customer at a bubble-tea counter in Taiwan. Act out exactly what the line shows: '
            'hesitant, pushy, whiny, smug or oblivious as the words suggest; conversational and natural.')
CROWD = 'A small crowd of customers booing and grumbling together, playful.'
ANNOUNCER = 'An excited game-show style announcer celebrating a milestone, upbeat and bright.'


def direction(job):
    role, style, part = job.get('role'), job.get('style'), job.get('part')
    if role == 'customer':
        body = CUSTOMER
    elif role == 'crowd':
        body = CROWD
    elif role == 'announcer':
        body = ANNOUNCER
    else:
        body = ' '.join(filter(None, [CLERK, CLERK_STYLE.get(style, CLERK_STYLE['deadpan']), HALF.get(part)]))
        if part == 'setup' and style not in ('polite',):
            body += ' Keep this half restrained so the next half can explode.'
    pace = job.get('speed', 1)
    if pace >= 1.25:
        body += ' Speak fast.'
    elif pace <= 0.92:
        body += ' Take your time on it.'
    return ' '.join([body, LANG_NOTE[job['lang']], GAME_NOTE])


def openai_hash(job, voice, model, text=None):
    src = '|'.join([model, voice, job['lang'], text if text is not None else job['text'], direction(job), str(job.get('part', ''))])
    if job.get('post'):
        src += '|' + json.dumps(job['post'], sort_keys=True)
    return hashlib.sha1(src.encode('utf-8')).hexdigest()[:8]


class Speech:
    def __init__(self, model, base_url, cache, key):
        self.model, self.base, self.cache, self.key = model, base_url.rstrip('/'), cache, key
        os.makedirs(cache, exist_ok=True)

    def pcm(self, job, voice, text):
        """24 kHz mono float32 for one text with the job's direction; cached on disk by its inputs."""
        text = text.strip()
        if not text:
            return np.zeros(0, dtype=np.float32)
        h = openai_hash(job, voice, self.model, text)
        path = os.path.join(self.cache, f'{h}-{hashlib.sha1(text.encode()).hexdigest()[:6]}.pcm')
        if not os.path.exists(path):
            body = {'model': self.model, 'voice': voice, 'input': text, 'response_format': 'pcm'}
            if self.model.startswith('tts-1'):
                body['speed'] = max(0.25, min(4.0, float(job.get('speed', 1))))
            else:
                body['instructions'] = direction(job)
            data = self._post(body)
            with open(path + '.part', 'wb') as f:
                f.write(data)
            os.replace(path + '.part', path)
        raw = np.frombuffer(open(path, 'rb').read(), dtype='<i2').astype(np.float32) / 32768.0
        return raw

    def _post(self, body, tries=6):
        req = urllib.request.Request(f'{self.base}/audio/speech', data=json.dumps(body).encode('utf-8'), method='POST',
                                     headers={'Authorization': f'Bearer {self.key}', 'Content-Type': 'application/json'})
        delay = 2.0
        for i in range(tries):
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    return r.read()
            except urllib.error.HTTPError as e:
                msg = e.read()[:300].decode('utf-8', 'replace')
                if e.code in (429, 500, 502, 503, 504) and i < tries - 1:
                    time.sleep(delay)
                    delay *= 2
                    continue
                sys.exit(f'build_openai.py: HTTP {e.code} from the speech API: {msg}')
            except (urllib.error.URLError, TimeoutError) as e:
                if i < tries - 1:
                    time.sleep(delay)
                    delay *= 2
                    continue
                sys.exit(f'build_openai.py: cannot reach the speech API ({e}); is the host allowed by the network policy?')
        raise RuntimeError('unreachable')


def render(speech, job, voice):
    keep = _keep(job)
    post = job.get('post')
    main = post_process(normalize(trim(speech.pcm(job, voice, job['text']), keep=keep or int(0.03 * SR))), post)
    bleeped = None
    if job.get('segments'):
        parts = []
        for seg in job['segments']:
            if seg['type'] == 'bleep':
                parts.append(bleep(len(seg['value'])))
            else:
                parts.append(post_process(normalize(trim(speech.pcm(job, voice, seg['value']), keep=keep or int(0.03 * SR))), post))
        bleeped = np.concatenate(parts) if parts else None
    return main, bleeped


# A fixed listening set: the clerk's contrast lines (setup + hit), curses, deadpan, rage, customers, the announcer.
SAMPLE_PICK = [('clerk', 'setup'), ('clerk', 'punch'), ('clerk', 'curse'), ('clerk', 'rage'), ('clerk', 'deadpan'),
               ('clerk', '250'), ('clerk', 'polite'), ('customer', None), ('announcer', None)]


def sample_jobs(jobs, per=3):
    out = []
    for lang in ('zh', 'en'):
        for role, what in SAMPLE_PICK:
            pool = [j for j in jobs if j['lang'] == lang and j.get('role') == role and (
                what is None or j.get('part') == what or (j.get('style') == what and not j.get('part')))]
            out += pool[:per if role == 'clerk' else 2]
    return out


def write_wav(path, audio):
    import wave
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(audio, -1, 1) * 32767).astype('<i2').tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('jobs')
    ap.add_argument('--out', help='voice pack folder (game/voice)')
    ap.add_argument('--sample', help='write a listening set of wav files here instead of building the pack')
    ap.add_argument('--model', default='gpt-4o-mini-tts')
    ap.add_argument('--base-url', default='https://api.openai.com/v1')
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--lang', choices=['zh', 'en'])
    ap.add_argument('--cast', help='JSON file {kokoroVoice: openaiVoice} merged over the built-in casting')
    ap.add_argument('--cache', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '.cache-openai'))
    args = ap.parse_args()
    if not args.out and not args.sample:
        sys.exit('build_openai.py: give --out <voice dir> or --sample <dir>')
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        sys.exit('build_openai.py: set OPENAI_API_KEY in the environment')
    cast = dict(CAST)
    if args.cast:
        cast.update(json.load(open(args.cast, encoding='utf-8')))
    jobs = json.load(open(args.jobs, encoding='utf-8'))
    missing = sorted({j['voice'] for j in jobs if j['voice'] not in cast})
    if missing:
        sys.exit(f'build_openai.py: no OpenAI voice cast for {missing}; add them with --cast')
    speech = Speech(args.model, args.base_url, args.cache, key)
    pool = ThreadPoolExecutor(max(1, args.workers))

    if args.sample:
        os.makedirs(args.sample, exist_ok=True)
        picks = sample_jobs(jobs)
        results = pool.map(lambda j: render(speech, j, cast[j['voice']])[0], picks)
        index = []
        for n, (job, audio) in enumerate(zip(picks, results), 1):
            name = f'{n:02d}-{job["lang"]}-{job.get("role")}-{job.get("part") or job.get("style")}.wav'
            write_wav(os.path.join(args.sample, name), audio)
            index.append(f'{name}\t{job["text"]}\t{direction(job)}')
        open(os.path.join(args.sample, 'index.tsv'), 'w', encoding='utf-8').write('\n'.join(index) + '\n')
        print(f'{len(picks)} samples → {args.sample} (index.tsv lists text and direction)', file=sys.stderr)
        return

    os.makedirs(args.out, exist_ok=True)
    manifest_path = os.path.join(args.out, 'manifest.json')
    old = json.load(open(manifest_path, encoding='utf-8')) if os.path.exists(manifest_path) else {'langs': {}}
    langs = [args.lang] if args.lang else ['zh', 'en']
    # render everything first (network calls can fail): the current pack is only replaced once all audio is in hand
    rendered = {}
    for lang in langs:
        todo = [j for j in jobs if j['lang'] == lang]
        print(f'{lang}: {len(todo)} to render', file=sys.stderr, flush=True)
        out = []
        for i, res in enumerate(pool.map(lambda j: render(speech, j, cast[j['voice']]), todo), 1):
            out.append(res)
            if i % 25 == 0 or i == len(todo):
                print(f'{lang}: {i}/{len(todo)}', file=sys.stderr, flush=True)
        rendered[lang] = list(zip(todo, out))
    # a build replaces the languages it rendered; the other language keeps its sprites and clips
    for f in os.listdir(args.out):
        if f.endswith('.mp3') and f.split('-')[0] in langs:
            os.remove(os.path.join(args.out, f))
    manifest = {'version': 1, 'sampleRate': SR, 'engine': f'OpenAI {args.model} (AI voice)', 'expressive': True,
                'langs': {l: v for l, v in old.get('langs', {}).items() if l not in langs}}
    for lang in langs:
        packer = Packer(args.out, lang, base=0)
        clips = {}
        for job, (main_audio, bleeped) in rendered[lang]:
            if main_audio.size == 0:
                print(f'[skip] {lang} {job["key"]} empty: {job["text"]!r}', file=sys.stderr)
                continue
            clip = packer.add(main_audio)
            clip['h'] = openai_hash(job, cast[job['voice']], args.model)
            if bleeped is not None and bleeped.size:
                clip['b'] = packer.add(bleeped)
            clips[job['key']] = clip
        packer.flush()
        manifest['langs'][lang] = {'chunks': packer.chunks, 'clips': clips}
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(',', ':'))
    total = sum(os.path.getsize(os.path.join(args.out, n)) for n in os.listdir(args.out))
    print(f'done: {sum(len(v["clips"]) for v in manifest["langs"].values())} clips, {total / 1e6:.1f} MB', file=sys.stderr)


if __name__ == '__main__':
    main()
