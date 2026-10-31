# Codex 任务：用 OpenAI 语音重做配音包

> 制作人（2026-10-31）："说文字的声音太僵硬了""还是太僵硬"。
>
> 现在的配音是 Kokoro（离线 AI，不能控制情绪）。店员"礼貌 → 突然爆骂 → 秒回专业"的反差演不出来，播放时的语调补救（`audio.js CONTOURS`）也不够。
>
> 这个任务是用 OpenAI 的语音模型重新生成**全部台词**（中文台湾华语 + 英文），每句都带演出指令。
>
> 脚本、游戏端的配合都已写好并测过（用本地假接口跑通了完整流程）。剩下的是**真正调用接口生成**、检查、提交。

## 0. 先读

- `AGENTS.md`、`CLAUDE.md`（设计规则必须遵守：只能有繁体中文和英文，不能有简体）。
- `game/tools/voice/build_openai.py` 文件开头的说明。
- `game/tools/voice/README.md`。

## 1. 环境（需要制作人先设置好）

- **网络：** 环境要能连到 `api.openai.com`。
- **密钥：** 环境变量 `OPENAI_API_KEY`（付费账户）。
  - **不要把密钥印出来、写进文件或提交。**
- **分支：** 从 `claude/claude-md-docs-facm46` 开始，完成后推到新分支 `codex/openai-voice`。

## 2. 步骤（都在 `game/` 下执行）

```bash
python3 -m pip install numpy lameenc
node tools/voice/export-lines.mjs > /tmp/voice-jobs.json          # 1106 句（zh 554 + en 552），约 21 000 字

# 2.1 试听样本（约 50 句：店员的铺垫 / 爆骂 / 怒吼 / 冷面 / 250 / 服务腔、客人、播报员）
python3 tools/voice/build_openai.py /tmp/voice-jobs.json --sample ../docs/voice/samples-openai

# 2.2 整包（会替换 game/voice/ 里的 mp3 和 manifest.json；回应有缓存，重跑只为新的或改过的句子付费）
python3 tools/voice/build_openai.py /tmp/voice-jobs.json --out voice
```

- 默认模型 `gpt-4o-mini-tts`，可以用 `--model` 换。
- 遇到 429（限流）脚本会自动退避重试。还是太快的话，把 `--workers 4` 调小。
- 失败时现有的配音包不会被动到：脚本会先把全部音频生成完，才替换文件。

## 3. 检查（全部要过）

```bash
node --test test/*.test.mjs
node tools/check-content.mjs                 # V2：manifest 对得上每一句台词
python3 -m http.server 8765 &
node tools/check-shop.mjs                    # 57/57
node tools/check-teach.mjs
node tools/check-opening.mjs                 # 33/33（开场时间轴用的是新音档长度）
node tools/check-signature.mjs
node tools/measure-pace.mjs                  # 记下第 1 天节奏和旧版的差别，写进回报
node tools/check-hant.mjs
pkill -f "m http.server 876[5]"
```

如果某项因为新音档变长或变短而失败，先回报，不要改游戏规则来迁就。

## 4. 文件

- `game/tools/voice/README.md`：在 Engine 和 Casting 加上 OpenAI 版（模型、生成日期、`CAST` 选角表）。
- `docs/audio-sourcing.md`：记录模型名称、日期，并注明条款要点：生成的音频可以商用，但需要告知玩家是 AI 语音，发布前要再确认一次。
- `CLAUDE.md` 设计规则里 "Voice lines come from `game/voice/` (Kokoro AI voices)" 这一句改成现况：现在由 OpenAI 生成，用 `build_openai.py` 重建，需要密钥；Kokoro 的 `build_voice.py` 作为离线备用。

## 5. 提交与回报

- **一个提交**，包含：`game/voice/*`、`docs/voice/samples-openai/*`（wav 和 index.tsv）、文件更新。
- **推送：** 推到 `codex/openai-voice`。
- **回报给制作人：**
  - 分支名称和提交编号；
  - 第 3 节每项检查的结果；
  - 第 1 天节奏的变化；
  - 大约用了多少字、多少钱；
  - 哪些句子听起来不对（AI 自己听不到的话就注明没有试听），以及建议调整的指令。

## 6. 如果效果不好，可以调这些地方

- **演出指令：** `build_openai.py` 里的 `CLERK_STYLE`（每种语气一句英文指令）、`HALF`（铺垫半句 / 爆骂半句）、`CUSTOMER`、`LANG_NOTE`（台湾口音）。改完重跑，只有指令变了的句子会重新生成。
- **选角：** `CAST`（Kokoro 声音名 → OpenAI 声音名）。也可以用 `--cast cast.json` 覆盖。
- **游戏端：** manifest 里有 `expressive: true` 时，`src/audio.js` 会套用 `EXPRESSIVE_FX`：关掉语调起伏、骂人那下不再加速、压缩变轻，保留撞击声和礼貌 / 爆骂的音量差。如果骂人的力道不够，可以把 `EXPRESSIVE_FX.driveDb` 调高。
