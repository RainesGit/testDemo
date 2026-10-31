"""Acted bilingual voice pack, generated locally with Qwen3-TTS + MLX Audio.

See README.md. No API key, voice clone, system voice recording, or paid request.
Render into a resumable WAV cache first; publish sprites and then the manifest only
after every requested clip (including bleeps) has rendered successfully.
"""

import argparse
import hashlib
import html
import importlib.metadata
import json
from pathlib import Path
import re
import subprocess
import tempfile
import time
import wave

import numpy as np

from build_voice import Packer, SR, bleep, normalize, trim

MODEL = 'mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit'
REVISION = '41d3337e8b7f2843a75841595fc14e4b9a7a4b96'
RECIPE = 1
# Fit the opening's 40 s budget and the existing free-play cadence without
# changing pitch, dropping words, or shortening the game's teaching beats.
OPENING_TEMPO = {'zh': 1.12, 'en': 1.48}
TIMEOUT_TEMPO = {'zh': 1.85, 'en': 2.0}
PLAY_TEMPO = {
    'zh': {'customer': 1.60, 'clerk': 1.72, 'crowd': 1.51, 'announcer': 1.51},
    'en': {'customer': 1.26, 'clerk': 1.64, 'crowd': 1.53, 'announcer': 1.56},
}
CAST = {
    'zm_yunjian': 'uncle_fu', 'am_fenrir': 'ryan',
    'zf_xiaobei': 'vivian', 'zm_yunxi': 'uncle_fu', 'zf_xiaoni': 'serena',
    'zm_yunyang': 'uncle_fu', 'zf_xiaoyi': 'serena', 'zm_yunxia': 'uncle_fu',
    'af_heart': 'vivian', 'am_puck': 'aiden', 'af_bella': 'serena',
    'am_echo': 'ryan', 'bf_emma': 'serena', 'am_adam': 'aiden',
    'af_sarah': 'vivian', 'bm_george': 'ryan',
    'zf_xiaoxiao': 'vivian', 'af_nova': 'vivian',
}
STYLES = {
    'zh': {
        'setup': '冷淡專業，短促自然。',
        'hit': '突然短促爆罵，清楚有力，立刻收尾。',
        'resolve': '立即恢復平靜專業，短促自然。',
        'polite': '甜膩過度客氣的服務腔，笑著說。',
        'curse': '突然短促爆罵，清楚有力，立刻收尾。',
        'rage': '快速有力地喊單，咬字清楚，立刻收尾。',
        'deadpan': '冷面疲倦，平靜乾脆。',
        'cold': '低聲冷淡，短促乾脆。',
        'disdain': '不耐煩地翻白眼，短促俐落。',
        'math': '快速算帳，數字清楚，理直氣壯。',
        'chuuni': '熱血認真地宣告，簡短有力。',
        '250': '一本正經報數字，冷面乾脆。',
        'twist': '先認同，突然冷淡地吐槽。',
        'real': '自然脫口而出，略帶疲倦。',
        'next': '俐落叫下一位，短促有力。',
    },
    'en': {
        'setup': 'Restrained professional service, brisk and conversational.',
        'hit': 'Sudden sharp comic outburst, forceful consonants, then stop.',
        'resolve': 'Instantly calm professional service, brisk and neutral.',
        'polite': 'Exaggeratedly sweet customer-service smile, comically too polite.',
        'curse': 'Sudden explosive outburst, crisp and forceful, then stop.',
        'rage': 'Rapid-fire kitchen calls, loud and rhythmic, clear words.',
        'deadpan': 'Dry, tired, matter-of-fact and brisk.',
        'cold': 'Curt, low and dismissive, falling cadence.',
        'disdain': 'Impatient audible eye-roll, conversational and clipped.',
        'math': 'Quick confident arithmetic, clear numbers, firm conclusion.',
        'chuuni': 'Sincere theatrical conviction, energetic and brief.',
        '250': 'Deadpan number as a verdict, clipped ending.',
        'twist': 'Agree, then snap into a dry dismissive punchline.',
        'real': 'Spontaneous tired reaction, conversational and brisk.',
        'next': 'Crisp forceful kitchen call, immediate finish.',
    },
}


def direction(job):
    lang = job['lang']
    role = job['role']
    if lang == 'zh':
        accent = '自然台灣華語，'
        if role == 'customer':
            body = '面對面點餐，口語自然，節奏輕快。'
        elif role == 'crowd':
            body = '短促起鬨抱怨，立刻收尾。'
        elif role == 'announcer':
            body = '興奮宣布好消息，明亮有精神。'
        else:
            body = STYLES[lang].get(job.get('beat') or job['style'], STYLES[lang]['deadpan'])
        return accent + body
    if role == 'customer':
        body = 'Casual face-to-face ordering, lively and conversational.'
    elif role == 'crowd':
        body = 'One short playful grumble, stop immediately.'
    elif role == 'announcer':
        body = 'Bright excited announcer, clear and energetic.'
    else:
        body = STYLES[lang].get(job.get('beat') or job['style'], STYLES[lang]['deadpan'])
    return 'Natural American English. ' + body


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def verify_snapshot(model_path):
    """Verify HF download receipts and file digests before naming a model in provenance."""
    root = Path(model_path)
    for name in ('config.json', 'model.safetensors', 'speech_tokenizer/model.safetensors',
                 'speech_tokenizer/config.json', 'tokenizer_config.json', 'vocab.json', 'merges.txt'):
        path = root / name
        receipt = root / '.cache/huggingface/download' / f'{name}.metadata'
        if not path.is_file() or not receipt.is_file():
            raise ValueError(f'Missing pinned HF download or receipt: {name}; see README.md')
        commit, expected, *_ = receipt.read_text().splitlines()
        if commit != REVISION:
            raise ValueError(f'Wrong model revision for {name}: expected {REVISION}')
        if len(expected) == 64:
            with path.open('rb') as f:
                actual = hashlib.file_digest(f, 'sha256').hexdigest()
        else:
            data = path.read_bytes()
            actual = hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
        if actual != expected:
            raise ValueError(f'Model file does not match its download receipt: {name}')


def request(job, text=None):
    source = text if text is not None else job['text']
    # An em dash is a performance mark, not permission to sustain a vowel until
    # the generation limit (especially a crowd "噓——！"). Keep the actual words.
    spoken = re.sub(r'[—–]+(?=[!！?？。，,]|$)', '', source)
    # Repeated ellipses are script pauses; feeding them literally can produce
    # seconds of hesitation or repeated sounds. The game schedules its own gaps.
    spoken = re.sub(r'^(?:\s|…|\.{3})+|(?:\s|…|\.{3})+$', '', spoken)
    spoken = re.sub(r'…+|\.{3,}', '，' if job['lang'] == 'zh' else ',', spoken)
    spoken = re.sub(r'([.!?。！？])\s*[,，]+', lambda m: m[1] + (' ' if job['lang'] == 'en' else ''), spoken)
    # Safe segments after a bleep can begin with the previous phrase's stop.
    spoken = re.sub(r'^[\s!！?？。，,;；:：—–.]+', '', spoken)
    return {'model': MODEL, 'revision': REVISION, 'recipe': RECIPE, 'lang': job['lang'],
            'speaker': CAST[job['voice']], 'text': spoken, 'sourceText': source,
            'direction': direction(job), 'temperature': 0.9, 'top_p': 1.0,
            'top_k': 50, 'repetition_penalty': 1.05}


def write_wav(path, audio):
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SR)
        out.writeframes((np.clip(audio, -1, 1) * 32767).astype('<i2').tobytes())


def read_wav(path):
    with wave.open(str(path), 'rb') as src:
        if (src.getnchannels(), src.getsampwidth(), src.getframerate()) != (1, 2, SR):
            raise ValueError(f'Invalid cached audio format: {path}')
        return np.frombuffer(src.readframes(src.getnframes()), dtype='<i2').astype(np.float32) / 32768


def processing(job):
    if job.get('scene') == 'opening':
        rates = TIMEOUT_TEMPO if job.get('reaction') == 'timeout' else OPENING_TEMPO
        rate = rates[job['lang']]
    else:
        rate = PLAY_TEMPO[job['lang']][job['role']]
    return {'tempo': rate, 'method': 'ffmpeg-atempo'}


def render_hash(job):
    return digest({'request': request(job), 'processing': processing(job)})[:16]


def apply_tempo(audio, job):
    rate = processing(job)['tempo']
    if rate == 1:
        return audio
    result = subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1',
        '-i', 'pipe:0', '-af', f'atempo={rate}', '-f', 'f32le', '-ar', str(SR), '-ac', '1', 'pipe:1',
    ], input=audio.astype('<f4').tobytes(), capture_output=True, check=True)
    stretched = np.frombuffer(result.stdout, dtype='<f4').copy()
    if len(stretched) < SR * 0.09 or not np.isfinite(stretched).all():
        raise ValueError('Invalid tempo processing; pack untouched')
    return normalize(stretched, peak=0.85)


def prepare_audio(audio):
    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    if not np.isfinite(audio).all():
        raise ValueError('Non-finite generated audio')
    # Keep consonants and breaths. Only remove silence at the outer edges.
    audio = trim(audio, thresh=0.003, keep=int(0.07 * SR))
    if len(audio) < SR * 0.09 or np.max(np.abs(audio)) < 0.003:
        raise ValueError('Empty or silent generated line')
    return normalize(audio, peak=0.85)


def duration_limit(req):
    # A safety bound for repetitions, not a request to cut speech mid-word.
    units = len(re.findall(r'\w', req['text'])) if req['lang'] == 'zh' else len(re.findall(r"[A-Za-z0-9]+(?:'[A-Za-z]+)?", req['text']))
    body = req['text'].rstrip('.,!?，。！？；;：: ')
    pauses = len(re.findall(r'[,.;:!?，。、；：！？—–]', body))
    return max(2.8, units / (3 if req['lang'] == 'zh' else 1.8) + 1) + 0.3 * pauses


def rendered_audio(req, result, max_tokens):
    if result.sample_rate != SR or result.token_count >= max_tokens:
        raise ValueError('Invalid sample rate or generation did not stop')
    audio = prepare_audio(result.audio)
    if len(audio) / SR > duration_limit(req):
        raise ValueError(f'Abnormally long delivery ({len(audio) / SR:.2f}s > {duration_limit(req):.2f}s); retry instead of truncating speech')
    return audio


def save_recording(cache, key, req, audio, generation):
    target = cache / f'{key}.wav'
    write_wav(target.with_suffix('.tmp'), audio)
    # The WAV is the completion marker, so save its provenance first.
    (cache / f'{key}.json').write_text(json.dumps({**req, 'generation': generation}, ensure_ascii=False, indent=2) + '\n')
    target.with_suffix('.tmp').replace(target)


def sample_jobs(jobs):
    selected = []
    for lang in ('zh', 'en'):
        pool = [j for j in jobs if j['lang'] == lang]
        # The opening already covers setups, short hits, customers, 250 and the return to service.
        picks = pool[:19]
        for role, style in [('clerk', 'polite'), ('clerk', 'rage'), ('announcer', 'announce'), ('crowd', 'boo')]:
            picks += [j for j in pool if j['role'] == role and j['style'] == style][:2]
        selected.extend({j['key']: j for j in picks}.values())
    return selected


def render_cache(jobs, cache, model_path, batch_size):
    cache.mkdir(parents=True, exist_ok=True)
    reqs = {}
    for job in jobs:
        items = [request(job)] + [request(job, s['value']) for s in job.get('segments', [])
                                  if s['type'] == 'text' and re.search(r'\w', s['value'])]
        for req in items:
            reqs[digest(req)] = req
    pending = [(key, req) for key, req in reqs.items() if not (cache / f'{key}.wav').exists()]
    print(f'{len(jobs)} jobs; {len(pending)}/{len(reqs)} unique recordings to generate', flush=True)
    if not pending:
        return
    from mlx_audio.tts.utils import load_model
    import mlx.core as mx
    mx.set_memory_limit(10 * 1024 ** 3)
    mx.set_cache_limit(512 * 1024 ** 2)
    model = load_model(model_path)
    start = time.monotonic()
    done = 0
    failed = []
    # Separate languages and group similar lengths to keep batched decoding efficient.
    for lang in ('zh', 'en'):
        todo = sorted((p for p in pending if p[1]['lang'] == lang), key=lambda p: len(p[1]['text']))
        for first in range(0, len(todo), batch_size):
            group = todo[first:first + batch_size]
            seed = 250 + first
            mx.random.seed(seed)
            max_tokens = int(max(duration_limit(r) for _, r in group) * 12.5) + 25
            seen = set()
            retry = []
            for result in model.batch_generate(
                texts=[r['text'] for _, r in group], voices=[r['speaker'] for _, r in group],
                instructs=[r['direction'] for _, r in group], lang_code='chinese' if lang == 'zh' else 'english',
                temperature=0.9, top_p=1.0, top_k=50, repetition_penalty=1.05,
                max_tokens=max_tokens, verbose=False,
            ):
                idx = result.sequence_idx
                if not 0 <= idx < len(group) or idx in seen:
                    raise ValueError('Model returned an invalid batch index; pack untouched')
                key, req = group[idx]
                seen.add(idx)
                try:
                    audio = rendered_audio(req, result, max_tokens)
                except ValueError:
                    retry.append((key, req))
                else:
                    save_recording(cache, key, req, audio, {'mode': 'batch', 'batchSize': len(group), 'seed': seed, 'attempt': 1})
            retry.extend(pair for idx, pair in enumerate(group) if idx not in seen)
            # Batched decoding occasionally loops a single sequence. Keep the
            # successful recordings and retry that line alone with a new seed.
            for key, req in retry:
                limit = int(duration_limit(req) * 12.5) + 25
                for attempt in range(1, 4):
                    single_seed = (int(key[:8], 16) + attempt) % (2 ** 32)
                    mx.random.seed(single_seed)
                    print(f'Retry {attempt}/3: {req["text"]}', flush=True)
                    results = list(model.generate_custom_voice(
                        text=req['text'], speaker=req['speaker'], instruct=req['direction'],
                        language='chinese' if lang == 'zh' else 'english', max_tokens=limit,
                        temperature=0.9, top_p=1.0, top_k=50, repetition_penalty=1.05, verbose=False,
                    ))
                    try:
                        if len(results) != 1:
                            raise ValueError('Model omitted or split a recording')
                        audio = rendered_audio(req, results[0], limit)
                    except ValueError as error:
                        print(f'  Rejected: {error}', flush=True)
                        if attempt == 3:
                            failed.append(req['text'])
                    else:
                        save_recording(cache, key, req, audio, {'mode': 'single-retry', 'seed': single_seed, 'attempt': attempt})
                        break
            done += len(group)
            print(f'{done}/{len(pending)} recordings processed; {len(failed)} failed; {time.monotonic() - start:.0f}s elapsed', flush=True)
            mx.clear_cache()
    if failed:
        raise ValueError(f'Failed after 3 single retries: {failed!r}; pack untouched')


def job_audio(job, cache):
    main = read_wav(cache / f'{digest(request(job))}.wav')
    muted = None
    if job.get('segments'):
        parts = []
        for seg in job['segments']:
            if seg['type'] == 'bleep':
                parts.append(bleep(len(seg['value'])))
            elif re.search(r'\w', seg['value']):
                parts.append(read_wav(cache / f'{digest(request(job, seg["value"]))}.wav'))
        muted = np.concatenate(parts)
    return apply_tempo(main, job), apply_tempo(muted, job) if muted is not None else None


def publish(jobs, cache, out):
    if {j['lang'] for j in jobs} != {'zh', 'en'}:
        raise ValueError('Publish both languages together; use --sample for an audition')
    out.mkdir(parents=True, exist_ok=True)
    old_path = out / 'manifest.json'
    old = json.loads(old_path.read_text()) if old_path.exists() else {}
    manifest = {'version': 1, 'sampleRate': SR, 'engine': 'Qwen3-TTS-1.7B / MLX (AI voice)',
                'expressive': True, 'langs': {}}
    records = []
    with tempfile.TemporaryDirectory(prefix='.voice-build-', dir=out.parent) as temp:
        stage = Path(temp)
        for lang in ('zh', 'en'):
            packer = Packer(str(stage), lang)
            clips = {}
            for job in (j for j in jobs if j['lang'] == lang):
                main, muted = job_audio(job, cache)
                clip = packer.add(main)
                clip['h'] = render_hash(job)
                if muted is not None:
                    clip['b'] = packer.add(muted)
                clips[job['key']] = clip
                receipt = cache / f'{digest(request(job))}.json'
                generation = json.loads(receipt.read_text()).get('generation') if receipt.exists() else None
                records.append({'key': job['key'], 'role': job['role'], 'style': job['style'],
                                'beat': job.get('beat'), 'scene': job.get('scene'), 'reaction': job.get('reaction'),
                                'processing': processing(job),
                                **request(job), 'generation': generation, 'duration': clip['d'],
                                'bleepDuration': clip.get('b', {}).get('d')})
            packer.flush()
            names = []
            for name in packer.chunks:
                path = stage / name
                unique = f'{lang}-acted-{hashlib.sha256(path.read_bytes()).hexdigest()[:16]}.mp3'
                path.rename(stage / unique)
                names.append(unique)
            manifest['langs'][lang] = {'chunks': names, 'clips': clips}
        provenance = {'model': MODEL, 'revision': REVISION, 'recipe': RECIPE, 'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                      'runtime': {name: importlib.metadata.version(name) for name in ('mlx-audio', 'mlx', 'transformers', 'numpy', 'lameenc')},
                      'ffmpeg': subprocess.check_output(['ffmpeg', '-version'], text=True).splitlines()[0],
                      'apiCostUSD': 0, 'records': records}
        (stage / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n')
        (stage / 'synthesis.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n')
        for path in stage.glob('*.mp3'):
            path.replace(out / path.name)
        (stage / 'synthesis.json').replace(out / 'synthesis.json')
        (stage / 'manifest.json').replace(old_path)
    # Old assets can be removed only after the new manifest is in place.
    current = {n for v in manifest['langs'].values() for n in v['chunks']}
    for v in old.get('langs', {}).values():
        for name in v.get('chunks', []):
            if name not in current and Path(name).name == name:
                (out / name).unlink(missing_ok=True)
    print(f'Published {len(records)} clips → {out}', flush=True)


def samples(jobs, cache, out):
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    for i, job in enumerate(jobs, 1):
        main, muted = job_audio(job, cache)
        name = f'{i:02d}-{job["lang"]}-{job["role"]}.wav'
        write_wav(out / name, main)
        rows.append({'file': name, 'key': job['key'], 'lang': job['lang'], 'role': job['role'],
                     'text': job['text'], 'direction': direction(job), 'processing': processing(job)})
        if muted is not None:
            write_wav(out / name.replace('.wav', '-bleep.wav'), muted)
    (out / 'index.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
    reels = ''
    for lang in ('zh', 'en'):
        selected = [r for r in rows if r['lang'] == lang]
        pieces = []
        for row in selected:
            pieces.extend([read_wav(out / row['file']), np.zeros(int(0.35 * SR), dtype=np.float32)])
        name = f'{lang}-showreel.wav'
        write_wav(out / name, np.concatenate(pieces))
        reels += f'<p>{lang} · 完整試聽 / Full reel</p><audio controls preload="none" src="{name}"></audio>'
    cards = ''.join(f'<li><p>{html.escape(r["lang"] + " · " + r["role"] + " · " + r["text"])}</p>'
                    f'<audio controls preload="none" src="{r["file"]}"></audio></li>' for r in rows)
    (out / 'index.html').write_text('<!doctype html><html lang="zh-Hant"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"><title>配音試聽 / Voice samples</title>'
        '<style>body{font:18px system-ui;max-width:800px;margin:40px auto;padding:0 20px;background:#fff8ee;color:#38241b}'
        'li{margin:24px 0}audio{width:100%}</style><h1>配音試聽 / Voice samples</h1>'
        '<p>Qwen3-TTS · AI 合成語音 / AI-generated voices</p>' + reels + '<ol>' + cards + '</ol></html>\n')
    print(f'{len(rows)} listening samples → {out / "index.html"}', flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('jobs', type=Path)
    ap.add_argument('--model-path', required=True, help='Pinned model snapshot; see README.md')
    ap.add_argument('--cache', type=Path, default=Path(__file__).parent / '.cache-acted')
    ap.add_argument('--batch-size', type=int, default=8)
    dest = ap.add_mutually_exclusive_group(required=True)
    dest.add_argument('--out', type=Path)
    dest.add_argument('--sample', type=Path)
    args = ap.parse_args()
    if not 1 <= args.batch_size <= 16:
        ap.error('--batch-size must be 1..16')
    jobs = json.loads(args.jobs.read_text())
    if len({j['key'] for j in jobs}) != len(jobs):
        ap.error('Duplicate job keys')
    if args.sample:
        jobs = sample_jobs(jobs)
    verify_snapshot(args.model_path)
    render_cache(jobs, args.cache, args.model_path, args.batch_size)
    if args.sample:
        samples(jobs, args.cache, args.sample)
    else:
        publish(jobs, args.cache, args.out)


if __name__ == '__main__':
    main()
