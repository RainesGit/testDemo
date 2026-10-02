# AI voice pack

The game plays pre-rendered voice clips from `game/voice/` (`manifest.json` plus a few mp3
sprites per language). Any line without a clip falls back to the browser's speech synthesis,
so the game still works if the pack is missing or out of date.

## Engine and license

- Model: **Kokoro-82M v1.0**, int8 ONNX (`model_quantized.onnx`), Apache-2.0. Commercial use and
  redistribution of generated audio are allowed. Taken from the npm package `kokoro-q8-shards`
  (byte-identical copy of `onnx-community/Kokoro-82M-v1.0-ONNX`, sha256
  `fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478`).
- Voices: the `voices/*.bin` style vectors shipped in the npm package `kokoro-js` (Apache-2.0).
- Mandarin text-to-phoneme: `misaki[zh]`; English: `kokoro-onnx`'s built-in espeak-ng phonemizer.
- Everything runs offline on CPU. Only npm and PyPI are needed to set up (Hugging Face and
  GitHub downloads are not required).

Re-check the licenses above before a commercial release (see `docs/audio-sourcing.md`).

## Casting

Set in `export-lines.mjs` (`CAST`, `SPEED`):

| Role | zh | en |
|---|---|---|
| Clerk | `zm_yunjian` | `am_fenrir` |
| Customers (rotated by id) | `zf_xiaobei`, `zm_yunxi`, `zf_xiaoni`, `zm_yunyang`, `zf_xiaoyi`, `zm_yunxia` | `af_heart`, `am_puck`, `af_bella`, `am_echo`, `bf_emma`, `am_adam`, `af_sarah`, `bm_george` |
| Milestone announcer | `zf_xiaoxiao` | `af_nova` |

Delivery style only changes speaking speed (and, at runtime, a small playback-rate shift for the
forced-polite voice). Kokoro has no emotion control, so this pack is a stand-in until a voice
actor records `docs/voice/voice-script-*.md`.

## Regenerate (after changing any line in `src/content.*.js`)

```bash
# one-time setup, anywhere outside the repo
mkdir -p ~/kokoro && cd ~/kokoro
python3 -m venv venv && . venv/bin/activate
pip install kokoro-onnx "misaki[zh]" lameenc
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

`clipKey()` in `src/audio.js` names each clip from the language and the line with stage
directions removed, so editing a line's wording requires a rebuild; editing only a stage
direction does not. Lines containing bleep words get a second, bleeped rendering that plays
when the bleep toggle is on.
