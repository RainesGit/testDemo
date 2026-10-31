# Codex 任务：让配音不再僵硬

> 制作人（2026-10-31）："说文字的声音太僵硬了""还是太僵硬"，"codex 自己想办法就可以，不用限制"。

## 目标

重做游戏的全部配音：中文（台湾华语）和英文，店员、客人、播报员。要听起来像真人在演，不要像机器在念：

- **店员的核心笑点是三拍反差：** 礼貌服务 → 突然爆骂 → 秒回专业。骂人那一下要有爆发力，礼貌话要甜到假。
- **快速连骂时也要听得清楚。**

**用什么工具、模型、服务、方法，全部由你决定，不设限制。**

## 现况（供参考）

- 现在的配音是 Kokoro（离线 AI），只能调语速、念得很平。生成脚本是 `game/tools/voice/build_voice.py`，说明在 `game/tools/voice/README.md`。
- 游戏在播放时为了补救做了一些处理（`game/src/audio.js` 的 `VOICE_FX`、`CONTOURS`）。配音包的 manifest 里写 `expressive: true` 时，会自动改用较轻的 `EXPRESSIVE_FX`。这些都可以按需要改或拿掉。
- 已经有一个现成的起点 `game/tools/voice/build_openai.py`：调用 OpenAI 语音接口，每句附上演出指令，用本地假接口测过。要不要用它，由你决定。
- **全部台词清单：** `node tools/voice/export-lines.mjs`（在 `game/` 下执行）。一共 1106 句，每句有角色、语气，以及是 `|` 前的铺垫半句还是后面的爆骂半句。
- **游戏读取的格式：** `game/voice/manifest.json` 加上 mp3 拼接档（见 `build_voice.py` 开头的说明）。用别的格式也可以，但要让游戏读得到。

## 完成后

- **检查：** 跑 `AGENTS.md` / `CLAUDE.md` 里列的检查，确认游戏正常，特别是 `check-content`、`check-shop`、`check-opening`。
- **试听样本：** 留一组给制作人听，例如放在 `docs/voice/samples/`。
- **回报：** 推到你选的分支，告诉制作人分支名称、做法、检查结果和花费。
