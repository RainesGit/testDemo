"""Fast contract tests for build_acted.py that do not load the TTS model."""

import json
import hashlib
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest import mock
import wave

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_acted as acted


def job(lang, *, masked=False):
    if lang == 'zh':
        value = {
            'lang': 'zh', 'key': 'zh-test', 'role': 'clerk', 'style': 'curse',
            'voice': 'zm_yunjian', 'speed': 1, 'text': '調你媽！',
        }
        if masked:
            value['segments'] = [
                {'type': 'text', 'value': '調'},
                {'type': 'bleep', 'value': '你媽'},
                {'type': 'text', 'value': '！'},
            ]
        return value
    return {
        'lang': 'en', 'key': 'en-test', 'role': 'customer', 'style': 'cust',
        'voice': 'af_heart', 'speed': 1, 'text': 'One cup, please.',
    }


class ActedBuilderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='voice-acted-test-')
        self.root = Path(self.temp.name)
        self.cache = self.root / 'cache'
        self.out = self.root / 'voice'
        self.cache.mkdir()
        self.jobs = [job('zh', masked=True), job('en')]

    def tearDown(self):
        self.temp.cleanup()

    @staticmethod
    def audio():
        t = np.arange(int(0.2 * acted.SR), dtype=np.float32) / acted.SR
        return (0.2 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)

    @staticmethod
    def result(audio, *, tokens=10, sample_rate=acted.SR, index=0):
        return types.SimpleNamespace(
            audio=audio, token_count=tokens, sample_rate=sample_rate,
            sequence_idx=index,
        )

    def fake_model_modules(self, model):
        seeds = []
        core = types.ModuleType('mlx.core')
        core.random = types.SimpleNamespace(seed=seeds.append)
        core.set_memory_limit = lambda _value: None
        core.set_cache_limit = lambda _value: None
        core.clear_cache = lambda: None
        mlx = types.ModuleType('mlx')
        mlx.core = core
        mlx_audio = types.ModuleType('mlx_audio')
        tts = types.ModuleType('mlx_audio.tts')
        utils = types.ModuleType('mlx_audio.tts.utils')
        utils.load_model = lambda _path: model
        mlx_audio.tts = tts
        tts.utils = utils
        modules = {
            'mlx': mlx, 'mlx.core': core, 'mlx_audio': mlx_audio,
            'mlx_audio.tts': tts, 'mlx_audio.tts.utils': utils,
        }
        return mock.patch.dict(sys.modules, modules), seeds

    def cache_job(self, item):
        requests = [acted.request(item)]
        requests.extend(
            acted.request(item, segment['value'])
            for segment in item.get('segments', [])
            if segment['type'] == 'text' and any(ch.isalnum() for ch in segment['value'])
        )
        for request in requests:
            acted.write_wav(
                self.cache / f'{acted.digest(request)}.wav', self.audio()
            )

    def seed_existing_pack(self):
        self.out.mkdir()
        manifest = b'{"sentinel":"old manifest"}\n'
        synthesis = b'{"sentinel":"old synthesis"}\n'
        sprite = b'old mp3 bytes'
        (self.out / 'manifest.json').write_bytes(manifest)
        (self.out / 'synthesis.json').write_bytes(synthesis)
        (self.out / 'old.mp3').write_bytes(sprite)
        return manifest, synthesis, sprite

    def assert_existing_pack_untouched(self, expected):
        manifest, synthesis, sprite = expected
        self.assertEqual((self.out / 'manifest.json').read_bytes(), manifest)
        self.assertEqual((self.out / 'synthesis.json').read_bytes(), synthesis)
        self.assertEqual((self.out / 'old.mp3').read_bytes(), sprite)
        self.assertEqual(
            sorted(path.name for path in self.out.iterdir()),
            ['manifest.json', 'old.mp3', 'synthesis.json'],
        )

    def test_publish_includes_bleeped_clip_and_both_languages(self):
        for item in self.jobs:
            self.cache_job(item)

        acted.publish(self.jobs, self.cache, self.out)

        manifest = json.loads((self.out / 'manifest.json').read_text())
        self.assertTrue(manifest['expressive'])
        self.assertEqual(set(manifest['langs']), {'zh', 'en'})
        self.assertIn('b', manifest['langs']['zh']['clips']['zh-test'])
        self.assertNotIn('b', manifest['langs']['en']['clips']['en-test'])
        self.assertTrue(
            all(
                (self.out / name).is_file()
                for language in manifest['langs'].values()
                for name in language['chunks']
            )
        )
        provenance = json.loads((self.out / 'synthesis.json').read_text())
        self.assertEqual(len(provenance['records']), 2)
        zh_record = next(row for row in provenance['records'] if row['lang'] == 'zh')
        self.assertGreater(zh_record['bleepDuration'], 0)

    def test_missing_cache_does_not_replace_existing_pack(self):
        expected = self.seed_existing_pack()
        self.cache_job(self.jobs[0])

        with self.assertRaises(FileNotFoundError):
            acted.publish(self.jobs, self.cache, self.out)

        self.assert_existing_pack_untouched(expected)

    def test_corrupt_cache_does_not_replace_existing_pack(self):
        expected = self.seed_existing_pack()
        for item in self.jobs:
            self.cache_job(item)
        target = self.cache / f'{acted.digest(acted.request(self.jobs[0]))}.wav'
        target.write_bytes(b'not a wave file')

        with self.assertRaises((ValueError, wave.Error, EOFError)):
            acted.publish(self.jobs, self.cache, self.out)

        self.assert_existing_pack_untouched(expected)

    def test_wrong_model_revision_is_rejected(self):
        model = self.root / 'model'
        receipt = model / '.cache/huggingface/download/config.json.metadata'
        receipt.parent.mkdir(parents=True)
        (model / 'config.json').write_text('{}\n')
        receipt.write_text('wrong-revision\ndeadbeef\n0\n')

        with self.assertRaisesRegex(ValueError, 'Wrong model revision'):
            acted.verify_snapshot(model)

    def test_snapshot_receipts_verify_git_and_lfs_hashes(self):
        model = self.root / 'model'
        names = (
            'config.json', 'model.safetensors',
            'speech_tokenizer/model.safetensors', 'speech_tokenizer/config.json',
            'tokenizer_config.json', 'vocab.json', 'merges.txt',
        )
        for index, name in enumerate(names):
            path = model / name
            path.parent.mkdir(parents=True, exist_ok=True)
            data = f'model fixture {index}\n'.encode()
            path.write_bytes(data)
            if name.endswith('model.safetensors'):
                expected = hashlib.sha256(data).hexdigest()
            else:
                expected = hashlib.sha1(
                    f'blob {len(data)}\0'.encode() + data
                ).hexdigest()
            receipt = model / '.cache/huggingface/download' / f'{name}.metadata'
            receipt.parent.mkdir(parents=True, exist_ok=True)
            receipt.write_text(f'{acted.REVISION}\n{expected}\n0\n')

        acted.verify_snapshot(model)
        (model / 'model.safetensors').write_bytes(b'corrupt')
        with self.assertRaisesRegex(ValueError, 'does not match'):
            acted.verify_snapshot(model)

    def test_publish_requires_both_languages(self):
        self.cache_job(self.jobs[0])

        with self.assertRaisesRegex(ValueError, 'both languages'):
            acted.publish([self.jobs[0]], self.cache, self.out)
        self.assertFalse(self.out.exists())

    def test_audio_validation_rejects_silence_caps_and_long_delivery(self):
        request = acted.request(self.jobs[0])
        with self.assertRaisesRegex(ValueError, 'silent'):
            acted.prepare_audio(np.zeros(int(0.2 * acted.SR), dtype=np.float32))
        with self.assertRaisesRegex(ValueError, 'did not stop'):
            acted.rendered_audio(
                request, self.result(self.audio(), tokens=50), max_tokens=50,
            )
        too_long = np.tile(self.audio(), 20)
        with self.assertRaisesRegex(ValueError, 'Abnormally long'):
            acted.rendered_audio(
                request, self.result(too_long), max_tokens=100,
            )

    def test_internal_punctuation_adds_pause_budget_but_short_hit_stays_tight(self):
        short = acted.request({**job('zh'), 'text': '滾！'})
        plain = acted.request({**job('zh'), 'text': '你你你還有你'})
        punctuated = acted.request({**job('zh'), 'text': '你、你、你，還有你！'})
        self.assertEqual(acted.duration_limit(short), 2.8)
        self.assertAlmostEqual(
            acted.duration_limit(punctuated) - acted.duration_limit(plain),
            0.9,
        )
        self.assertEqual(acted.duration_limit(punctuated), 3.9)

        t = np.arange(int(3.75 * acted.SR), dtype=np.float32) / acted.SR
        delivery = (0.2 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
        accepted = acted.rendered_audio(
            punctuated, self.result(delivery), max_tokens=100,
        )
        self.assertGreater(len(accepted) / acted.SR, acted.duration_limit(plain))
        with self.assertRaisesRegex(ValueError, 'Abnormally long'):
            acted.rendered_audio(plain, self.result(delivery), max_tokens=100)

    def test_english_duration_counts_hyphenated_words_and_reasonable_pauses(self):
        short = acted.request({**job('en'), 'text': "Don't."})
        dishwater = acted.request({
            **job('en'), 'text': "All four? That's dishwater. Next.",
        })
        two_fifty = acted.request({
            **job('en'), 'text': 'Fits two-fifty. Classic two-fifty.',
        })
        self.assertEqual(acted.duration_limit(short), 2.8)
        self.assertAlmostEqual(acted.duration_limit(dishwater), 5 / 1.8 + 1.6)
        self.assertAlmostEqual(acted.duration_limit(two_fifty), 6 / 1.8 + 1.3)

        t = np.arange(int(4.37 * acted.SR), dtype=np.float32) / acted.SR
        delivery = (0.2 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
        acted.rendered_audio(dishwater, self.result(delivery), max_tokens=100)

        too_long = np.tile(self.audio(), 27)
        with self.assertRaisesRegex(ValueError, 'Abnormally long'):
            acted.rendered_audio(
                dishwater, self.result(too_long), max_tokens=100,
            )

    def test_role_and_timeout_tempos_shorten_main_and_bleep_without_shifting_pitch(self):
        item = job('zh', masked=True)
        self.cache_job(item)
        raw_main = acted.read_wav(
            self.cache / f'{acted.digest(acted.request(item))}.wav'
        )
        raw_bleep = np.concatenate([
            acted.read_wav(
                self.cache / f'{acted.digest(acted.request(item, "調"))}.wav'
            ),
            acted.bleep(len('你媽')),
        ])
        fast_main, fast_bleep = acted.job_audio(item, self.cache)
        opening = {**item, 'scene': 'opening'}
        opening_main, opening_bleep = acted.job_audio(opening, self.cache)
        timeout = {**opening, 'reaction': 'timeout'}
        timeout_main, timeout_bleep = acted.job_audio(timeout, self.cache)

        self.assertLess(len(fast_main), len(raw_main))
        self.assertLess(len(fast_bleep), len(raw_bleep))
        self.assertLess(len(opening_main), len(raw_main))
        self.assertLess(len(opening_bleep), len(raw_bleep))
        self.assertGreater(len(opening_main), len(fast_main))
        self.assertGreater(len(opening_bleep), len(fast_bleep))
        self.assertLess(len(timeout_main), len(fast_main))
        self.assertLess(len(timeout_bleep), len(fast_bleep))

        t = np.arange(2 * acted.SR, dtype=np.float32) / acted.SR
        tone = (0.2 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
        for lang, roles in acted.PLAY_TEMPO.items():
            base = job(lang)
            for role, tempo in roles.items():
                processed = acted.apply_tempo(tone, {**base, 'role': role})
                self.assertAlmostEqual(len(tone) / len(processed), tempo, delta=0.03)
                spectrum = np.abs(np.fft.rfft(processed))
                peak = np.fft.rfftfreq(len(processed), 1 / acted.SR)[spectrum.argmax()]
                self.assertAlmostEqual(peak, 440, delta=4)
        for lang, tempo in acted.OPENING_TEMPO.items():
            processed = acted.apply_tempo(tone, {**job(lang), 'scene': 'opening'})
            self.assertAlmostEqual(len(tone) / len(processed), tempo, delta=0.03)
            spectrum = np.abs(np.fft.rfft(processed))
            peak = np.fft.rfftfreq(len(processed), 1 / acted.SR)[spectrum.argmax()]
            self.assertAlmostEqual(peak, 440, delta=4)
        for lang, tempo in acted.TIMEOUT_TEMPO.items():
            processed = acted.apply_tempo(
                tone, {**job(lang), 'scene': 'opening', 'reaction': 'timeout'},
            )
            self.assertAlmostEqual(len(tone) / len(processed), tempo, delta=0.03)
            spectrum = np.abs(np.fft.rfft(processed))
            peak = np.fft.rfftfreq(len(processed), 1 / acted.SR)[spectrum.argmax()]
            self.assertAlmostEqual(peak, 440, delta=4)

    def test_render_hash_includes_processing_recipe(self):
        ordinary = job('zh')
        opening = {**ordinary, 'scene': 'opening'}
        timeout = {**opening, 'reaction': 'timeout'}
        self.assertEqual(acted.request(ordinary), acted.request(opening))
        self.assertEqual(acted.request(opening), acted.request(timeout))
        self.assertEqual(
            acted.processing(ordinary),
            {'tempo': 1.72, 'method': 'ffmpeg-atempo'},
        )
        self.assertEqual(
            acted.processing(opening),
            {'tempo': 1.12, 'method': 'ffmpeg-atempo'},
        )
        self.assertEqual(
            acted.processing(timeout),
            {'tempo': 1.85, 'method': 'ffmpeg-atempo'},
        )
        self.assertNotEqual(acted.render_hash(ordinary), acted.render_hash(opening))
        self.assertNotEqual(acted.render_hash(opening), acted.render_hash(timeout))

        en_timeout = {**job('en'), 'scene': 'opening', 'reaction': 'timeout'}
        self.assertEqual(
            acted.processing(en_timeout),
            {'tempo': 2.0, 'method': 'ffmpeg-atempo'},
        )

    def test_cast_short_directions_and_native_sampling_recipe(self):
        zh = acted.request(job('zh'))
        en_clerk = acted.request({
            **job('en'), 'role': 'clerk', 'voice': 'am_fenrir',
            'style': 'deadpan',
        })
        self.assertEqual(zh['speaker'], 'uncle_fu')
        self.assertEqual(en_clerk['speaker'], 'ryan')
        self.assertEqual(
            zh['direction'],
            '自然台灣華語，突然短促爆罵，清楚有力，立刻收尾。',
        )
        self.assertEqual(
            {key: zh[key] for key in (
                'temperature', 'top_p', 'top_k', 'repetition_penalty',
            )},
            {'temperature': 0.9, 'top_p': 1.0, 'top_k': 50,
             'repetition_penalty': 1.05},
        )
        zh_voices = {
            acted.CAST[key] for key in acted.CAST
            if key.startswith(('zf_', 'zm_'))
        }
        self.assertEqual(zh_voices, {'uncle_fu', 'vivian', 'serena'})
        stretched = acted.request({**job('zh'), 'text': '噓——！'})
        self.assertEqual(stretched['text'], '噓！')
        self.assertEqual(stretched['sourceText'], '噓——！')

    def test_performance_ellipses_are_removed_without_changing_source_text(self):
        leading = acted.request({**job('zh'), 'text': '……拆糖費。'})
        self.assertEqual(leading['text'], '拆糖費。')
        self.assertEqual(leading['sourceText'], '……拆糖費。')

        internal = acted.request({**job('zh'), 'text': '好……算了。'})
        self.assertEqual(internal['text'], '好，算了。')
        self.assertEqual(internal['sourceText'], '好……算了。')

        after_stop = acted.request({
            **job('zh'), 'text': '下一位！……我說下一位！',
        })
        self.assertEqual(after_stop['text'], '下一位！我說下一位！')
        self.assertEqual(after_stop['sourceText'], '下一位！……我說下一位！')

        english = acted.request({**job('en'), 'text': '...Ummm...'})
        self.assertEqual(english['text'], 'Ummm')
        self.assertEqual(english['sourceText'], '...Ummm...')

        english_after_stop = acted.request({
            **job('en'), 'text': 'They want a reservation. …Shoo.',
        })
        self.assertEqual(
            english_after_stop['text'], 'They want a reservation. Shoo.',
        )
        self.assertEqual(
            english_after_stop['sourceText'],
            'They want a reservation. …Shoo.',
        )

        safe_tail = acted.request({**job('zh'), 'text': '！原味最好喝。'})
        self.assertEqual(safe_tail['text'], '原味最好喝。')
        self.assertEqual(safe_tail['sourceText'], '！原味最好喝。')

    def test_bad_batch_result_retries_alone_and_records_attempt(self):
        item = job('zh')
        key = acted.digest(acted.request(item))
        good = self.audio()

        class Model:
            def batch_generate(model_self, **kwargs):
                yield self.result(good, tokens=kwargs['max_tokens'])

            def generate_custom_voice(model_self, **_kwargs):
                model_self.calls = getattr(model_self, 'calls', 0) + 1
                if model_self.calls == 1:
                    yield self.result(np.zeros_like(good))
                else:
                    yield self.result(good)

        model = Model()
        modules, seeds = self.fake_model_modules(model)
        with modules:
            acted.render_cache([item], self.cache, self.root / 'model', 8)

        receipt = json.loads((self.cache / f'{key}.json').read_text())
        generation = receipt['generation']
        expected_seed = (int(key[:8], 16) + 2) % (2 ** 32)
        self.assertEqual(
            generation,
            {'mode': 'single-retry', 'seed': expected_seed, 'attempt': 2},
        )
        self.assertEqual(model.calls, 2)
        self.assertEqual(seeds[-2:], [
            (int(key[:8], 16) + 1) % (2 ** 32), expected_seed,
        ])
        self.assertTrue((self.cache / f'{key}.wav').is_file())

    def test_three_failed_retries_leave_no_completion_marker(self):
        item = job('zh')
        key = acted.digest(acted.request(item))
        silent = np.zeros_like(self.audio())

        class Model:
            def batch_generate(model_self, **kwargs):
                yield self.result(self.audio(), tokens=kwargs['max_tokens'])

            def generate_custom_voice(model_self, **_kwargs):
                model_self.calls = getattr(model_self, 'calls', 0) + 1
                yield self.result(silent)

        model = Model()
        modules, _seeds = self.fake_model_modules(model)
        with modules, self.assertRaisesRegex(ValueError, 'Failed after 3'):
            acted.render_cache([item], self.cache, self.root / 'model', 8)

        self.assertEqual(model.calls, 3)
        self.assertFalse((self.cache / f'{key}.wav').exists())

    def test_multiple_failures_are_collected_after_other_recordings_are_cached(self):
        good = {**job('zh'), 'key': 'good', 'text': '好。'}
        bad_one = {**job('zh'), 'key': 'bad-one', 'text': '壞一。'}
        bad_two = {**job('zh'), 'key': 'bad-two', 'text': '壞二。'}
        expected_pack = self.seed_existing_pack()
        tone = self.audio()

        class Model:
            def batch_generate(model_self, **kwargs):
                for index, text in enumerate(kwargs['texts']):
                    tokens = 10 if text == '好。' else kwargs['max_tokens']
                    yield self.result(tone, tokens=tokens, index=index)

            def generate_custom_voice(model_self, **kwargs):
                model_self.calls = getattr(model_self, 'calls', [])
                model_self.calls.append(kwargs['text'])
                yield self.result(np.zeros_like(tone))

        model = Model()
        modules, _seeds = self.fake_model_modules(model)
        with modules, self.assertRaisesRegex(ValueError, 'Failed after 3') as raised:
            acted.render_cache(
                [good, bad_one, bad_two], self.cache, self.root / 'model', 8,
            )

        message = str(raised.exception)
        self.assertIn('壞一。', message)
        self.assertIn('壞二。', message)
        self.assertEqual(model.calls.count('壞一。'), 3)
        self.assertEqual(model.calls.count('壞二。'), 3)
        self.assertTrue(
            (self.cache / f'{acted.digest(acted.request(good))}.wav').is_file()
        )
        self.assertFalse(
            (self.cache / f'{acted.digest(acted.request(bad_one))}.wav').exists()
        )
        self.assertFalse(
            (self.cache / f'{acted.digest(acted.request(bad_two))}.wav').exists()
        )
        self.assert_existing_pack_untouched(expected_pack)


if __name__ == '__main__':
    unittest.main()
