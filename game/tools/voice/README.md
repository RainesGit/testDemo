# AI voice pack

> **Acted local builder.** `build_acted.py` renders the complete bilingual pack with Qwen3-TTS 1.7B CustomVoice
> through MLX Audio on Apple Silicon. Every line gets a role and acting direction; no API key or paid requests.
> The other builders remain available: `build_voice.py` (Kokoro, offline) and `build_openai.py` (OpenAI speech API).
> All three use the same jobs and sprite format. Acted packs set `expressive: true`, selecting the lighter
> `EXPRESSIVE_FX` in `src/audio.js`. The optional API builder needs `OPENAI_API_KEY` and network access.

The game plays pre-rendered voice clips from `game/voice/` (`manifest.json` plus a few mp3
sprites per language). Any line without a clip falls back to the browser's speech synthesis,
so the game still works if the pack is missing or out of date.

## Acted local generation (Apple Silicon, Python 3.12)

The fixed model is [`mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit`](https://huggingface.co/mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit),
revision `41d3337e8b7f2843a75841595fc14e4b9a7a4b96`, converted from
[`Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice)
(Apache-2.0). [MLX Audio](https://github.com/Blaizzy/mlx-audio) is MIT licensed. Use the **1.7B** CustomVoice model:
the 0.6B variant does not support acting instructions. Download is about 3 GB; generation then runs locally.
Use a fresh virtual environment outside the repository; do not install these packages into system Python.
FFmpeg must also be on `PATH` (for example, `brew install ffmpeg` on macOS).

```bash
python3.12 -m venv /tmp/250cups-voice-env
/tmp/250cups-voice-env/bin/python -m pip install -r tools/voice/requirements-acted.txt
HF_HOME=/tmp/250cups-hf /tmp/250cups-voice-env/bin/hf download \
  mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit \
  --revision 41d3337e8b7f2843a75841595fc14e4b9a7a4b96 --local-dir /tmp/250cups-qwen
node tools/voice/export-lines.mjs > /tmp/250cups-voice-jobs.json
# First audition the opening, service voice, rapid curses, announcer and crowd in both languages.
/tmp/250cups-voice-env/bin/python tools/voice/build_acted.py /tmp/250cups-voice-jobs.json \
  --model-path /tmp/250cups-qwen --sample ../docs/voice/samples
# Then render all lines. Cached WAVs are reused; interrupted runs can be resumed with the same command.
/tmp/250cups-voice-env/bin/python tools/voice/build_acted.py /tmp/250cups-voice-jobs.json \
  --model-path /tmp/250cups-qwen --out voice
```

- `--batch-size 8` is the default; reduce it on Macs with less memory. The script verifies the pinned model's
  download receipts and hashes before generation. Keep its `.cache/huggingface/download` receipts.
- `beat` is the acting intent (`setup`, `hit`, `resolve`), independently of `part`, which is the playback cut-point
  position. This preserves curse-first lines and the opening's sudden return to professional service.
- Chinese input stays Traditional throughout; concise instructions ask for conversational Taiwan Mandarin.
  English instructions ask for conversational American English. Accent and naturalness require listening;
  an instruction or waveform check alone cannot establish them.
- Built-in Qwen speaker presets supply the cast. No real person's recording or operating-system voice is cloned.
  The Chinese clerk uses `uncle_fu`, English uses `ryan`; customers rotate the corresponding language's cast
  (`uncle_fu` / `vivian` / `serena` for Chinese; `ryan` / `aiden` / `vivian` / `serena` for English).
  The announcer uses `vivian`. Legacy voice IDs in exported jobs are mapped by `build_acted.py`'s `CAST`.
- Use the model's native sampling defaults (temperature 0.9, top-p 1, top-k 50, repetition penalty 1.05).
  Long acting prompts caused repeated or stretched short lines in development, so directions are concise.
  Repeated ellipses and trailing long-sound dashes are normalized before synthesis; original script text is
  retained in `sourceText`. Cut-point pauses remain scheduled by the game.
  A sequence that reaches the token limit, is silent, or exceeds a text-length duration bound (including internal
  punctuation pauses) is retried alone with up to three different seeds. Speech is never cut to fit that bound.
  Failed lines are reported after the remaining successful recordings are cached; any failure leaves the published pack intact.
- Outer silence is trimmed with 70 ms padding and peaks normalized to 0.85. No baked pitch contour.
  Jobs tagged `scene: opening` use FFmpeg `atempo` (Chinese 1.12, English 1.48), preserving pitch while fitting
  the acted delivery into the opening's 40 s budget. Opening jobs also tagged `reaction: timeout` use
  Chinese 1.85 / English 2.0 so four missed prompts still fit the 70 s timeout-route budget; normal and
  wrong-key responses retain the opening tempo. Free-play tempos are calibrated by role to the previous
  pack's mean clip durations: zh customer 1.60 / clerk 1.72 / crowd 1.51 / announcer 1.51; en customer 1.26 /
  clerk 1.64 / crowd 1.53 / announcer 1.56. This compensates for the model's slower delivery without changing
  game rules or cutting words. A line shared with free play retains its opening or timeout tempo, as it already shares
  the same key and cast. The original WAV cache
  remains untouched; publishing and sample export apply identical processing to main and bleep variants.
  Bleep variants synthesize the safe text segments with the same cast and direction and insert the existing tone.
- `tools/voice/.cache-acted/` holds WAVs keyed by text, cast, model revision, direction and sampling recipe. A complete
  build writes new content-addressed MP3 sprites, then replaces the manifest. Old sprites are removed afterwards.
  An incomplete render never replaces the current pack. Both languages must be published together.
- `voice/synthesis.json` records each clip's text, speaker, direction, duration, model revision, runtime versions,
  generation mode, random seed, tempo processing and FFmpeg version. The manifest's `h` includes both the
  synthesis request and processing settings; raw cache keys contain only the synthesis request.
  `apiCostUSD: 0` means no provider API charge; local electricity and hardware are not estimated.
- `docs/voice/samples/index.html` is the listening player; `index.json` maps the samples to text and acting directions.
- Acceptance is delegated as specified in `AGENTS.md`. The builder regression suite is
  `python tools/voice/test_acted.py`; run it in the same virtual environment. Game tests and browser checks remain
  required, particularly `check-content`, `check-opening`, and `check-shop`. Close any test browser and server afterwards.

## Legacy Kokoro engine and license

- Model: **Kokoro-82M v1.0**, int8 ONNX (`model_quantized.onnx`), Apache-2.0. Commercial use and
  redistribution of generated audio are allowed. Taken from the npm package `kokoro-q8-shards`
  (byte-identical copy of `onnx-community/Kokoro-82M-v1.0-ONNX`, sha256
  `fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478`).
- Voices: the `voices/*.bin` style vectors shipped in the npm package `kokoro-js` (Apache-2.0).
- Mandarin text-to-phoneme: `misaki[zh]`; English: `kokoro-onnx`'s built-in espeak-ng phonemizer.
- Traditional → Simplified for the G2P: OpenCC (`opencc-python-reimplemented`, Apache-2.0). The game's Chinese is
  Taiwan Traditional at the source and clip keys are computed from it; `build_voice.py` converts each zh line with
  OpenCC `t2s` (plus 著 → 着, the aspect particle) right before `misaki`, which is trained on Simplified text. Only
  the TTS input changes: keys, job hashes, `jobs.json` and the manifest stay Traditional, and the audio is what the
  old Simplified source rendered (the one spoken word that changed is #88's 投訴 → 客訴).
- Everything runs offline on CPU. Only npm and PyPI are needed to set up (Hugging Face and
  GitHub downloads are not required).

Re-check the licenses above before a commercial release (see `docs/audio-sourcing.md`).

## Legacy Kokoro casting

Set in `export-lines.mjs` (`CAST`, `SPEED`):

| Role | zh | en |
|---|---|---|
| Clerk | `zm_yunjian` | `am_fenrir` |
| Customers (rotated by id) | `zf_xiaobei`, `zm_yunxi`, `zf_xiaoni`, `zm_yunyang`, `zf_xiaoyi`, `zm_yunxia` | `af_heart`, `am_puck`, `af_bella`, `am_echo`, `bf_emma`, `am_adam`, `af_sarah`, `bm_george` |
| Milestone announcer | `zf_xiaoxiao` | `af_nova` |

Delivery style only changes speaking speed (at runtime `src/audio.js` adds an intonation contour per clip, `CONTOURS`, and a small playback-rate shift for the
forced-polite voice). The emphasis on the hit of a line is added at runtime by the voice punch chain in
`src/audio.js` (`VOICE_FX`, see `game/README.md`); `?punchfx=0` turns it off for comparison.

Opening routine customers (`SYSTEM.opening.c*`): zh `zm_yunxi` / `zm_yunyang` / `zf_xiaoni`, en `am_puck` /
`am_echo` / `af_bella` (customer 3 and the day-3 original customer share one voice).

## Cut points, numbers, what gets exported

- **`|` cut points** (docs/first-minute-spec.md 3.1, R10). A line such as `還在想？|滾！` is exported as two jobs,
  `part: 'setup'` (speed 1.10) and `part: 'punch'` (speed 0.90), keyed `clipKey(lang, half)`; the whole line is not
  exported. At runtime `audio.playClerk()` plays setup → silence (`punchGapMs`, 200 ms by default) → punch. Setup
  halves keep a 40 ms tail when trimmed. Used by the opening routine and the 21 Day 1 pool customers.
- **Numbers.** The TTS text goes through `audio.ttsText()`: zh `250杯` → `二百五十杯`, `15` → `十五`, `37%` →
  `百分之三十七`; en `250` → `two-fifty`, `15` → `fifteen`. Keys still come from the displayed text.
- **Order.** Opening routine first, then customers, then system lines; when two lines share a key the first job's
  voice and speed win (e.g. the punch `滾！` is shared by many lines and the rage chant).
- `SYSTEM.opening` is exported except its display-only parts (`dayCard`, `signs`, `cue`, `hz`, `recap`, `plate`,
  `closing`); `SYSTEM.originalCustomer` is exported; `signature250` no longer exists.
- `node tools/check-content.mjs` V2 compares the manifest against exactly this job list. The acted builder uses
  `beat` to direct delivery; the legacy Kokoro builder uses only speed. Human recording scripts remain in
  `docs/voice/voice-script-*.md`.

## Legacy Kokoro render profiles (per-segment settings)

Each job carries its own Kokoro `speed` and, optionally, a `post` step. `export-lines.mjs` picks them from a
profile (`RENDER_PROFILES`):

| Profile | Lead half | Hit half (and 調你媽 `r4`) | Rage lines |
|---|---|---|---|
| `spec` (default legacy profile, spec 8.6 item 7) | speed 1.10 | speed 0.90 | speed 1.30 |
| `punchy` (`--punchy` or `--profile=punchy`) | speed 0.95 | speed 1.10, `post: { gainDb: 6, ceiling: 0.95 }` | speed 1.30, `post: { gainDb: 4, ceiling: 0.95 }` |

- The **hit** is the punch half; with `punchy` it is the curse half when the curse comes first
  (`調你媽！|黃金比例最好喝！`: 調你媽 is the hit, 黃金比例 is rendered as the lead), using `audio.voicePlan()`.
  `spec` speed stays positional; the separate `beat` field records acting intent for expressive builders.
- `build_voice.py` applies `post` after normalizing: +`gainDb`, then a peak limiter (1 ms look-ahead,
  80 ms release, hard ceiling). On the samples it raised the punch RMS by 2.7–4 dB at the same peak.
- `post` is part of the clip hash only when present, so `--incremental` keeps existing `spec` clips and
  re-renders exactly the punchy ones.
- Changing speed changes clip lengths, so the opening and day pacing move with them (timings come from
  the manifest; nothing to edit). If the pack is rebuilt with `punchy`, listen with the runtime chain on:
  the hit then gets both the baked speed-up and `VOICE_FX.punchRate` (1.06); lower that to about 1.0 if it
  sounds rushed.

```bash
node tools/voice/export-lines.mjs --punchy > /tmp/voice-jobs.json   # then build_voice.py as below
```

## Legacy Kokoro regeneration

For the current acted pack, use the local generation commands above after changing a spoken line.

```bash
# one-time setup, anywhere outside the repo
mkdir -p ~/kokoro && cd ~/kokoro
python3 -m venv venv && . venv/bin/activate
pip install kokoro-onnx "misaki[zh]" lameenc opencc-python-reimplemented
npm pack kokoro-q8-shards@1.0.0 kokoro-js@1.2.1
tar xzf kokoro-q8-shards-1.0.0.tgz && cat package/kokoro-q8.part{0..5}.bin > kokoro-q8.onnx && rm -rf package
tar xzf kokoro-js-1.2.1.tgz
python - <<'EOF'
import glob, os, numpy as np
np.savez('voices.npz', **{os.path.basename(f)[:-4]: np.fromfile(f, dtype=np.float32).reshape(-1, 1, 256)
                          for f in glob.glob('package/voices/*.bin')})
EOF

# render (from game/, with the venv active; takes ~15-20 min on 4 CPU cores)
node tools/voice/export-lines.mjs > /tmp/voice-jobs.json
python tools/voice/build_voice.py /tmp/voice-jobs.json \
  --model ~/kokoro/kokoro-q8.onnx --voices ~/kokoro/voices.npz --out voice
```

For a few edited lines, add `--incremental`: clips whose key **and** rendering inputs (TTS text,
speed, voice, part; stored as the clip's `h` hash) are unchanged are kept, and only new or changed lines
are rendered into new sprites (seconds instead of ~25 minutes). Clips from packs built before the hash
existed have no `h`, so the first incremental run re-renders everything; run a full build instead. Run a
full build now and then to drop audio for deleted lines from the sprites.

`clipKey()` in `src/audio.js` names each clip from the language and the line with stage
directions removed, so editing a line's wording requires a rebuild; editing only a stage
direction does not. Lines containing bleep words get a second, bleeped rendering that plays
when the bleep toggle is on.
