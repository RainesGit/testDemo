# 验收报告（2026-10-31，16ec78f + 本次工作树改动）

## 结论

**⚠️ 客观验收通过，主观配音验收待制作人试听。** 游戏、内容、开场、店铺、节奏、语音包完整性与发布安全检查均通过。最终包含 1106 条双语 clip，中文 554 条、英文 552 条；浏览器全超时路线中英文都在 70 秒内完成。当前执行环境不能接收音频输入，也没有可用的本地 ASR 权重，因此没有实际听到或转录这些录音，不能确认台湾口音、自然度、三拍演技、字词完整性及“二百五十 / quarter-wit”的实际发音。

另有一项与本次配音包无关的既有补充问题：`check-voice.mjs` 的 fake-mic “反差”奖励检查连续两次失败；旧 HEAD `16ec78f` 同样复现，详见失败项。

## 自动化与内容

| 编号 | 结果 | 证据 |
|---|---|---|
| A1 | ✅ 通过 | `node --test test/*.test.mjs`：308/308，`fail 0`。最终 timeout 代码加入后另跑 `audio.test.mjs` 32/32；`test_acted.py` 16/16。 |
| A2 | ✅ 通过 | `node tools/check-content.mjs`：26/26；V2-zh `554/554`、V2-en `552/552`，V3 export/runtime key 一致。 |
| A3 | ✅ 通过 | `play-integrate.mjs`：zh opening 38.848 s、首牌 2.775 s、自由营业 12 人；en opening 38.820 s、首牌 2.371 s、自由营业 10 人。两者均 `errors: []`、`overflow: false`、开场引擎仅 idle、无 sign timer，打烊卡不可误跳过，能进入第 2 天与战报。timeout 提速只作用于 `reaction: timeout`，不影响该正确路线。 |
| A4 | ✅ 通过（组合证据） | 修复前整轮 QA 为 25/26，唯一失败是 zh 全超时 75.759 s，正确路线与乱按路线均通过。最终包定向复验：zh 全超时 `69,342 ms`、en 全超时 `69,470 ms`，均看到 W1–W4、console/page errors 0、退出码 0；余量分别 658/530 ms。最终修复只改变 timeout clip 的 tempo。 |
| A5 | ✅ 通过 | `check-signature.mjs`：15/15；开场、自由营业 250 顾客及第 3 天原片顾客两步均通过。 |
| A6 | ✅ 通过 | 最终包 `check-opening.mjs`：33/33。390×844 与 360×640 的开场、错误键、提示、跳过、锁定和花字均通过；A13 为 `0/2312` 帧超过 32 ms（0.0%），SVG 峰值 392。 |
| B1–B4、H1–H4 | ✅ 通过 | `check-content` 全过：中英文各 100 位顾客，规则字段一致，系统台词、开场结构、切点和牌子长度完整。 |
| C1–C7 | ✅ 通过 | 自动红线全过；明骂顾客 10 位，按错键气势 `70 → 70` 且队伍 `+1`。 |
| C8–C10（人工） | ✅ 通过 | 逐条阅读 `content.zh.js` 与 `content.en.js` 共 200 位顾客的名称、顾客台词、reply、alt；可疑编号 0。笑点针对点单行为，不按外貌、性别、种族、出身、政治或宗教区别对待；所有顾客均可被三个键处理。 |

## 浏览器、节奏与画面

| 编号 | 结果 | 证据 |
|---|---|---|
| D1–D15 | ✅ 通过 | `play-integrate` 中英通过；`check-opening` 33/33；`check-signature` 15/15。代表截图：`game/tools/shots/opening-390x844-E4-tiaonima.png`、`opening-390x844-E12-ticket.png`、`opening-390x844-day1-first.png`。 |
| D16 | ✅ 通过 | `check-hant.mjs`：10/10。zh-CN 浏览器仍选 zh，`lang` 为 `zh-Hant-TW`；第 1、3–7 天采集 276 段中文，简体字符 0，errors 0。 |
| 店铺流程 | ✅ 通过 | favicon 修复后的新浏览器上下文运行 `check-shop.mjs`：57/57；覆盖第 1–5 天、升级、多杯、250 预付、竖屏、语音输入模式，`no console errors / page errors`。代表截图：`game/tools/shots/shop-844-day1-play.png`。 |
| H1–H13 | ✅ 通过 | `check-opening`：首牌 2.800–2.909 s；P4→首位可操作 15.594–15.606 s；3 次错误键均在 300 ms 内有新字幕；开场结束 queue 12；花字/牌子无重叠；首次无 skip、回访可 skip。全超时最终中英均 ≤70 s。 |
| I1–I7 | ✅ 自动项通过；⚠️ 真机待验 | A11 源码/DOM 无 emoji，360×640 字号与按键尺寸通过，花字无重叠；抽查高潮、号码牌、店铺与 timeout 截图，未见裁切或明显层级错误。4× CPU 无头结果 0.0%；仍按 F8 在真机复测。 |
| 第 1 天 45 s 节奏 | ✅ 恢复旧包水平；⚠️ 仍低于设计估计 | 原始新包：7/8/7，均值 7.3；按角色 tempo 校准后：10/11/10，均值 10.3；旧 HEAD：10/11/10，均值 10.3。校准后平均 cycle `4593/4113/4605 ms`，旧包 `4760/4260/4607 ms`；最终无 timeout/cut-in。已消除本次 7.3 的回退，但规格估计约 13 人的既有 F10 差距仍在。 |

## 语音包与试听样本

| 编号 | 结果 | 证据 |
|---|---|---|
| 包完整性 | ✅ 通过 | 独立审计 export、manifest、synthesis：1106 jobs，zh 554/en 552；26 条含 bleep；31 个 MP3 sprite 全部以 24 kHz mono 解码，clip offset/duration 均在分块边界内；key、render hash、request、role/style/beat/scene/reaction/processing 全一致。 |
| 构建安全 | ✅ 通过 | Python 16/16：模型 revision/receipt/hash 校验、缺失或损坏缓存不发布、wrong revision 拒绝、双语完整包、三次重试/静音/过长边界、失败汇总、bleep、标点预处理、tempo 优先级及音高保持。65 条记录来自 single retry；任一失败保留旧 manifest。 |
| provenance | ✅ 通过 | Qwen3-TTS 1.7B CustomVoice 8-bit，revision `41d3337e8b7f2843a75841595fc14e4b9a7a4b96`；运行时 `mlx-audio 0.6.3`、`mlx 0.32.4`、`transformers 5.22.1`、`numpy 2.5.4`、`lameenc 1.9.0`；`apiCostUSD: 0`。 |
| tempo / hash | ✅ 通过 | timeout 优先于 opening，再优先于自由营业角色速度；zh/en timeout 为 1.85/2.0，opening 为 1.12/1.48。主音轨与 bleep 同步处理；440 Hz 合成音的处理后峰值仍约 440 Hz。raw request/cache hash 不随 tempo 变，render hash 会变。 |
| 试听样本 | ✅ 客观一致 | `docs/voice/samples/index.json` 共 54 条（中英文各 27），2 条另含 bleep；逐样本读取 24 kHz mono WAV，与最终 cache 经相同 processing 得到的 PCM 逐样本完全一致，共比对 56 个 WAV；中英 showreel 存在。 |
| E1 | ✅ 通过 | 浏览器请求 manifest 与语言 MP3；debug 下 voice pack/clip 覆盖由浏览器检查及 V1–V3 证实。 |
| E2–E5、E7–E9 | ⚠️ 未完成主观验收 | 当前模型不支持接收本地 WAV 作为音频输入；尝试提交 audio data URL 时返回不支持。没有 Whisper、mlx-whisper、faster-whisper 或已缓存 ASR 模型，故未用波形、方向提示或文件存在性推断音色、口音、演技、自然度和实际字词。需制作人实际播放 `docs/voice/samples/index.html`。 |
| E6 | ✅ 客观结构通过；⚠️ 听感未验 | 26 个 bleep job 的主/消音 clip 均存在且边界合法；54 样本中 2 个 bleep WAV 与构建结果逐 PCM 一致。1 kHz 哔声是否听感合适仍需试听。 |
| 产物校验值 | ✅ 记录 | manifest SHA-256 `78a75f92be22f276824ef6e8503398318b4551ea1b8992beb172913d50527a3e`；synthesis `dbcf314729739adf434597edcc5e7586fce19008432701086ac6a94973f7939b`；sample index `d650175994644c1685c70831889b86e6c640d08980bbdba4b132c7c075a67f44`。 |

## 失败项详情

- **补充 X1：fake-mic 反差检查（既有问题，非本次配音包回归）**
  - 复现：最终工作树运行 `node tools/check-voice.mjs` 两次。
  - 实际：两次均 12/13；`contrast` 为 `0 contrast bonuses`，每次均检测到 53 个 peaks。其余 mic-ready、四个开场等待点、12 次 voice answer、karaoke、rage 扫 11 个头、自回放、kill-list、loudest 与 no-errors 全过。
  - 对照：同一脚本对旧 HEAD `16ec78f` 的游戏资源运行，也得到 `contrast=0`（49 peaks），说明问题已存在；旧 HEAD 另有 favicon 404，而当前包 no-errors 通过。
  - 期望：fake WAV 的 soft setup ≥300 ms 后接吼声，应至少触发一次反差奖励。没有修改脚本、阈值或麦克风实现。
- **主观音频未验**：这是环境能力限制，不是自动化失败。必须由能实际听音频的人确认台湾口音、英文口音、三拍反差、爆点力度、清晰度、自然度、角色差异、群众叠声与关键字词。

## 已知问题现状（F1–F11）

- **F1：确认已解决。** v3 中英文内容完整；保留清单列出的 #57 备用句与明骂位置说明。
- **F2：确认已解决。** 英文 250 文案一致；删除线字幕仍未实现。
- **F3：确认已解决。** 按下即结算，蓄力与完美可并存；Node/浏览器回归通过。
- **F4：确认已解决。** 大特效队列回归通过。
- **F5：确认已解决。** 新手保护与第一次超时逻辑通过。
- **F6：部分改善、主观待验。** 已改为支持逐句演出指令的 Qwen3-TTS，并记录 beat/role/style；当前环境未实际听取，不能确认台湾口音、自然度、爆点及“秒回正经”。正式版真人配音计划仍适用。
- **F7：确认已解决。** 全部显示与当前 Qwen 输入均为台湾繁体；动态 `check-hant` 10/10。
- **F8：无头检查通过，真机仍待验。** 4× CPU 为 0.0% 慢帧，优于 5% 门槛。
- **F9：仍存在。** 第 3 天后爆气可能直接结算正好在柜台的原片顾客；本任务未改规则。
- **F10：仍存在，但本次回退已修复。** 最终实测 45 s 均值 10.3，与旧包相同，仍低于规格估计约 13。
- **F11：确认已解决。** 最终 1106 条完整覆盖，V2-zh/en 与独立审计通过。

## 主观评价

- **节奏**：客观计时显示开场正常路线约 38.8–39.0 s、全超时约 69.3–69.5 s，自由营业恢复旧包 10.3 人/45 s；没有把“快”延伸成声音自然度判断。
- **好不好笑、最爽、最无聊**：未实际听到新录音，无法诚实评价语音笑点、爆发力或拖沓处。视觉抽查中“調你媽！”独占画面、号码牌和回到自由营业的层级清楚，但这不能替代音频评价。
- **最值得优先做的 3 件事**：
  1. 制作人用 54 条试听页与中英 showreel 实际听一遍，重点检查“二百五十 / quarter-wit”、台湾华语口音、服务腔→爆骂→专业三拍、群众叠声与 bleep。
  2. 单独修复或稳定 `check-voice` 的 fake-mic 反差输入/检测，让旧 HEAD 也失败的 X1 有可靠回归覆盖。
  3. 若设计仍坚持 45 s 约 13 人，在不截词的前提下继续研究落地/字幕/录音时长预算；当前 10.3 已与旧包持平，不应把本次配音任务误报为达成 13 人。

## 清理

验收未启动模拟器。所有 Playwright/Google Chrome 上下文均由脚本关闭；旧 HEAD 对照服务器 `127.0.0.1:8766` 与主验收服务器 `127.0.0.1:8765` 均收到 Ctrl-C 并退出。`lsof` 对两端口均无监听输出；提权只读 `ps` 核对时，只匹配到检查命令自身，没有残留 Chrome/Chromium 或 HTTP server 进程。
