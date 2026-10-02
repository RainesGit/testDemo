# 《来250杯！》音效 / 音乐 / 配音来源调研（可商用、不侵权）

> 调研日期：2026-10-02。
> **核实方式说明**：本次调研环境的网络代理阻断了对 kenney.nl、pixabay.com、mixkit.co、sonniss.com、incompetech.com、support.google.com 等官方页面的直接抓取，因此所有结论通过 WebSearch 检索官方页面和权威二手页面的摘要核实。表格中「核实程度」一栏写明了核实情况。**正式上架前，请由人工打开每个官方授权页逐条复核，并对每个下载的文件截图或保存授权页 PDF 留证。**
> 授权条款会变。下载素材时，把**当时的授权页**和**素材页**存档（截图或 PDF），放进 `docs/licenses/`（目录待建）。

---

## 0. 结论先行（TL;DR）

1. **原型阶段（现在）：零素材文件。** 音效全部用 WebAudio 程序化合成（`src/audio.js` 已按此约定），语音用浏览器 Web Speech API 实时朗读。不分发任何第三方音频，版权风险约等于零。
2. **上架版音效：** 优先用 **Kenney（CC0）**，再用 **Sonniss GDC 包**（免版税、免署名，只能打包进游戏，不能单独再分发），然后用 **Freesound 中的 CC0 素材**，**Mixkit / Pixabay** 作补充。都不需要署名，但我们仍在制作人员名单里致谢，方便留证。
3. **上架版音乐：** 快节奏搞笑 BGM 用 **Kevin MacLeod（CC BY 4.0，必须署名）**，或者 Pixabay / Mixkit 的免署名曲目。预算允许时，委托作曲并买断，最干净。
4. **上架版配音：** 店员是本作的灵魂，**推荐找台湾真人配音员录中文、美国配音员录英文，签「游戏用途永久买断」**。预算紧时，用 **Azure 神经 TTS（zh-TW 声线）或 Amazon Polly** 预先生成音频文件随包发布（两者都允许商用并保存音频）。ElevenLabs 只能用**付费方案**。
5. **绝对不用：** 网络梗视频原声、影视/动漫/综艺台词片段、流行歌（哪怕只有几秒）、模仿特定名人声音的 AI 克隆。
6. **预算区间：** 原型 0 元；独立小上架版约 NT$0–5,000（纯 TTS 加免费音效）；推荐上架版约 **NT$40,000–120,000**（中英文真人配音买断，加一首委托 BGM）。明细见第 5 节。

---

## 1. 音效与音乐来源对比表

| 来源 | 类型 | 授权 | 需署名？ | 再分发 / 内购限制 | 适合本游戏的用途 | 核实程度 | 链接 |
|---|---|---|---|---|---|---|---|
| **Kenney** | 音效（Interface Sounds 100 个、Impact Sounds 130 个、Voiceover Pack 90 个等）、少量音乐 | **CC0**（公有领域贡献） | 否（可选致谢 "Kenney"） | CC0 无限制：可商用、可修改、可再分发，可放进内购内容 | 拍柜台 `slam`（Impact Sounds）、按键 `pop` 和号码牌 `ding`（Interface Sounds）、`milestone` 叮当（Music Jingles）。Voiceover Pack 是格斗游戏腔的英文播报，可作英文版「READY / GO」类素材 | 已核实（搜索摘要来自 kenney.nl/support 和资源页） | https://kenney.nl/support ・ https://kenney.nl/assets/impact-sounds ・ https://kenney.nl/assets/interface-sounds ・ https://kenney.nl/assets/voiceover-pack |
| **OpenGameArt (OGA)** | 音效、音乐、少量语音 | **每个资源单独授权**：CC0 / CC-BY 3.0·4.0 / CC-BY-SA 3.0·4.0 / OGA-BY 3.0·4.0 / GPL 2.0·3.0 | 视授权：CC0 不需要，BY、OGA-BY 需要，BY-SA 需要且衍生作品须同协议（不适合闭源素材），GPL 有传染性 | 站方称所有资源都允许商用。**本项目只取 CC0，其次 CC-BY / OGA-BY；不取 BY-SA 和 GPL** | 补充嘘声、群众欢呼、搞笑 8-bit jingle | 已核实（OGA FAQ 摘要） | https://opengameart.org/content/faq |
| **Freesound** | 音效、环境声、人声片段 | 每个文件单独授权：**CC0** / CC BY / CC BY-NC（以及旧的 Sampling+） | CC0 不需要；CC BY 需要 | **只选 CC0**（用站内 license 过滤器）。BY-NC 禁止商用，**不得使用** | 真实人群嘘声 `boo`、欢呼 `cheer`、街头环境声（骑楼、捷运广播底噪等需自录或找 CC0）、甩门、纸杯声 | 已核实（Freesound FAQ 摘要） | https://freesound.org/help/faq/ |
| **Pixabay（音效 + 音乐）** | 音效、音乐 | Pixabay Content License（自有协议，非 CC） | 否（鼓励致谢） | **禁止以「Standalone」形式出售或分发**（即未经创作加工、原样作为音频文件、音效包或音乐包出售，包括内购单独卖音效包）。嵌入游戏里使用是允许的。部分音乐可能被第三方登记 Content ID，**要保留下载证明** | 快节奏搞笑 BGM、cartoon whoosh、boing、爆笑音效 | 已核实（Pixabay license-summary / FAQ 摘要） | https://pixabay.com/service/license-summary/ ・ https://pixabay.com/service/terms/ |
| **Mixkit** | 音效、音乐 | Mixkit License（Free License） | 否 | 允许商用，包括游戏和应用。音乐和音效**不得单独再分发或转售**（条款细则因 www.mixkit.co 被代理阻断，**未逐条核实**） | 游戏类音效（Mixkit 有 game 分类）：combo 提示、得分、失败嘘声 | 部分核实（搜索摘要；原文未读到） | https://mixkit.co/license/ ・ https://mixkit.co/free-sound-effects/game/ |
| **Sonniss #GameAudioGDC 免费包**（每年 GDC 发布，2026 版 7.47GB+；历年合集 200GB+） | 音效（专业级 WAV） | Sonniss GDC Bundle License：免版税，可无限项目、终身使用 | 否 | **不得把音效作为独立文件或音效库再分发或转售**；可以作为成品游戏的一部分出售。**禁止用于 AI/ML 训练** | 高质量拍桌、玻璃杯、冰块摇晃（手摇饮真实感！）、人群反应、whoosh | 已核实（gdc.sonniss.com 与 sonniss.com/gdc-bundle-license 摘要） | https://gdc.sonniss.com/ ・ https://sonniss.com/gdc-bundle-license/ ・ https://sonniss.com/gameaudiogdc/ |
| **YouTube Audio Library** | 音乐、音效 | 两类：① YouTube 标准授权；② 部分曲目 CC BY 4.0 | ① 不需要；② 需要 | **① 标准授权曲目只能用在 YouTube 视频等「你创作的视频内容」里，不得与视频分离单独提供或分发，不能放进游戏。** ② CC BY 曲目理论上可用于游戏，但要按曲目页署名。**整体不推荐作游戏素材来源**，只适合做宣传 PV 上 YouTube | 仅用于 YouTube 宣传片配乐 | 部分核实（support.google.com 页面被阻断，只核实到搜索摘要引用的条款原文） | https://support.google.com/youtube/answer/3376882 |
| **Incompetech / Kevin MacLeod** | 音乐（大量喜剧、马戏、快节奏曲目） | **CC BY 4.0**；另可付费购买 Standard License 免署名 | **是**，格式：`"曲名" Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 https://creativecommons.org/licenses/by/4.0/` | CC BY 允许商用和随游戏分发。付费 Standard License 价格据二手资料约 **US$30–40/首（未核实官方价）** | 主菜单和结算 BGM（推荐风格：马戏、快板 polka、搞笑追逐类）。署名放在「关于 / 制作人员」页 | 已核实授权类型和署名格式（incompetech FAQ 摘要）；价格未核实 | https://incompetech.com/music/royalty-free/licenses/ ・ https://incompetech.com/music/royalty-free/faq.html |
| **WebAudio 程序化合成（自制）** | 音效 | 自有代码生成，著作权归我方 | 否 | 无限制 | 原型全部 sfx：`slam whoosh boo cheer ding pop rage shake milestone bleep` | 不适用（自制） | 见 `game/src/audio.js` |

### 补充：使用规则
- **一个文件，一条记录**：在 `docs/licenses/ASSETS.csv`（待建）记录 `文件名, 来源URL, 作者, 授权, 下载日期, 截图路径`。
- CC0 和免署名素材也写进制作人员名单的「Sound credits」，成本为零，还能自证来源。
- **内购商品**（例如「骂人音效包 DLC」「换声线」）：只用 **CC0、自制、委托买断** 的素材。Pixabay、Mixkit、Sonniss 的条款都限制「把素材本身作为主要价值单独售卖」，用在内购里有争议，**不建议**。

---

## 2. 搞笑配音的三种路线对比

| 维度 | A. 真人配音员 | B. 商用授权 AI 语音 / TTS 服务 | C. 浏览器 Web Speech API |
|---|---|---|---|
| 搞笑效果 | ★★★★★ 能演出嚣张、中二、翻白眼、破音、反差服务腔 | ★★★☆☆ 声线不错，但「演技」有限；ElevenLabs 类情绪表现较好 | ★☆☆☆☆ 机器腔，靠调语速音高制造喜感（反而有一种冷面笑点） |
| 台湾腔真实度 | 找台湾配音员最自然 | Azure 有 zh-TW 神经声线；ElevenLabs 多语言可用但台湾腔不稳定（未实测） | 取决于玩家设备是否有 zh-TW 声线，iOS / macOS 一般有，Android / Windows 不一定 |
| 版权 / 授权 | 签约买断即可完全掌控 | 看服务条款，见下表 | 实时在玩家设备上朗读，**不分发音频文件**。系统声线本身的授权归 OS 厂商；**不要录下来再分发**（各 OS 声线授权条款未核实） |
| 成本 | 最高（见第 5 节） | 低：按字符计费或月费 | 0 |
| 迭代速度 | 慢：每改一句台词都要补录 | 快：改完重新生成 | 最快：改文字即生效 |
| 适合阶段 | 正式上架 | 软上线、Demo、补录 | **原型（现在）** |

### 2A. 真人配音员（台湾 / 美国）

| 平台 | 地区 | 授权与计价要点 | 核实程度 | 链接 |
|---|---|---|---|---|
| PRO360 达人网 | 台湾 | 平台收的是接案方的「客源开发费」，客户免费发案。行情：广告配音每 30 秒约 NT$3,000–10,000；旁白约每 500 字 NT$2,000–5,000；动画按集计价。**广告类通常只授权 1 年，续播要另付续播费；戏剧、动画类大多永久使用** | 已核实（PRO360 价格页摘要） | https://www.pro360.com.tw/price/dubbing ・ https://www.pro360.com.tw/category/dubbing |
| 出任务 Tasker | 台湾 | 2026 年配音报价参考页；中文商业旁白约每分钟 NT$4,000–5,000（约 200 字内） | 已核实（价格页摘要） | https://www.tasker.com.tw/price/voice-over |
| Voices.com | 美国 / 全球 | 分 Broadcast（限时、限地区的广告用途）和 **Non-Broadcast（含电子游戏，通常永久全买断 full buyout）** 两种授权；游戏和 App 的报价会因游戏规模浮动 | 已核实（Voices.com Understanding Licensing 摘要） | https://www.voices.com/help/knowledge/faq/Understanding-Licensing ・ https://www.voices.com/company/terms-and-policies/terms-of-service |
| Fiverr | 全球 | 默认交付物给买家「all rights」，**但用于营利必须另购 Gig Extra「Commercial Use License」**（永久、独占、不可转让的许可，**卖家仍保留所有权**）。部分配音 gig 的 Commercial Rights / Broadcast Rights 是 **1 年期附加项**，务必选永久或游戏用途 | 已核实（Fiverr ToS 与社区公告摘要） | https://community.fiverr.com/forums/topic/320178-the-new-commercial-rights-1-year-and-full-broadcasting-rights-1-year-add-ons/ |

**签约必写条款（检查清单）：**
1. 用途：**电子游戏内语音（含所有平台、所有地区、永久）**，以及游戏宣传片、商店页试听。
2. **是否允许把录音用于 AI 声线训练或克隆**：默认写「不允许」，以示尊重。若想以后用 AI 补录，必须单独写明并加价。
3. 是否允许剪辑、变调、加哔声、混音（本作有「消音」玩法，**必须允许**）。
4. 署名方式（制作人员名单写艺名 / 本名）。
5. 补录费（改台词时的单价）、交付格式（48kHz/24bit WAV，每句一个文件，按 `id_reply.wav`、`id_alt.wav` 命名）。
6. 配音员为工会成员（例如美国 SAG-AFTRA）时，游戏配音有工会协议和费率要求。**未核实**具体费率，找美国配音员时先问清楚是否 union。
7. 台词里有「你妈」「靠北」这类脏话，先跟配音员确认愿意录，并约定提供一版干净的替代读法。

### 2B. 商用授权的 AI 语音 / TTS 服务

| 服务 | 能否用于游戏商用 | 能否把生成的音频随游戏分发 | 注意事项 | 核实程度 | 链接 |
|---|---|---|---|---|---|
| **Amazon Polly** | 可以 | **可以**：FAQ 写明可把输出存成 MP3/OGG 等标准音频文件，用于「redistribution」，缓存和重播不另收费 | 中文声线以普通话为主，**台湾腔声线是否可用未核实**；英文声线多 | 已核实（Polly FAQ 摘要） | https://aws.amazon.com/polly/faqs/ |
| **Microsoft Azure AI Speech（神经 TTS）** | 可以（付费层），预置神经声线的输出可商用 | 可以（Microsoft Q&A 引述 Product Terms：付费层的输出可用于商业用途）；**不得用于训练竞品 TTS**；要做合成内容披露 | **有 zh-TW 声线**（例如 HsiaoChen / YunJhe，声线名以控制台为准），支持 SSML 风格和语速，最适合本作中文店员的 TTS 方案。官方文档有游戏开发专题页 | 部分核实（Microsoft Q&A 回答和官方游戏专题页摘要；Product Terms 原文未读到） | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/gaming-concepts ・ https://learn.microsoft.com/en-nz/answers/questions/5987029/can-audio-generated-with-azure-text-to-speech-be-p |
| **Google Cloud Text-to-Speech** | 可以（官方文档说可用生成的音频驱动应用、增强视频和录音），无署名要求 | **存疑**：二手资料称「每次请求为终端用户实时生成」稳妥，「重新打包成音频库」不被允许；随包分发预生成文件**未核实**，需看 Google Cloud 服务条款原文 | 不得训练竞品语音合成 | 部分核实 | https://docs.cloud.google.com/text-to-speech/docs/basics ・ https://discuss.google.dev/t/text-to-speech-api-license/187973 |
| **ElevenLabs** | **仅付费方案**（Starter 约 US$5/月起）可商用，用途含游戏 | 付费方案生成的内容可永久商用，退订后仍有效 | **免费方案禁止商用**，且发布时须标注 "elevenlabs.io" 或 "11.ai"。**禁止克隆真人或名人声音冒充他人**。表现力强，适合中二和爆气腔 | 已核实（ElevenLabs Help Center 摘要） | https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform |

**TTS 路线的通用规则：**
- 预生成音频时，在哪个账号、哪个方案、哪天生成的都要留存记录（账单截图）。条款以生成当时为准。
- 不用「声音克隆」模仿任何名人、网红、主播或动漫角色的声线（涉及人格权、肖像 / 声音权以及平台政策）。
- 商店页和游戏内「关于」页注明「部分语音由 AI 合成」。Azure 要求披露，同时也能降低争议。

### 2C. 原型阶段：浏览器 Web Speech API（当前方案）
- `speechSynthesis` 在玩家本机实时合成，可用声线**取决于浏览器和操作系统**（`getVoices()` 的结果由 user agent 决定）。来源：https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
- 不打包任何音频，**没有再分发问题**。但**不要**把系统声线录下来做成音频文件发布：各 OS 声线的授权条款**未核实**。
- 搞笑做法：按 style 调 `rate` / `pitch`（`audio.js` 契约已规定：curse 快而高、cold 慢而低、chuuni 先慢后快、deadpan 平）。再配合 WebAudio 合成的 `slam` / `bleep` 掩盖机器腔。机器腔一本正经地骂人，本身就有反差笑点。

---

## 3. 不能用的东西清单（除非取得书面授权）

| 不能用 | 原因 | 参考 |
|---|---|---|
| 网络梗视频的原声（抖音 / TikTok / YouTube / B 站热门片段、「某某名场面」） | 视频里的声音同时可能是**录音著作、视听著作和表演**，还涉及当事人的人格权；梗再红也不是公有领域。商业游戏很难主张合理使用 | 台湾著作权法第 5 条（含录音著作）、第 65 条合理使用的四项判断基准：https://law.moj.gov.tw/LawClass/LawAll.aspx?PCode=J0070017 ・ 智慧局著作权一点通：https://www.tipo.gov.tw/tw/copyright/701-21230.html |
| 影视、动漫、综艺、广告的台词片段（哪怕 1 秒） | 视听著作和录音著作；配音员的表演也受保护 | 同上 |
| 流行歌、口水歌、BGM 梗（哪怕只哼几小节或改编） | 音乐著作（词曲）**加**录音著作，双重权利；自己翻唱只解决录音，不解决词曲 | 同上 |
| 「原视频的声音」，包括自己从视频里剥离或降调处理过的 | 加工后仍是对原录音的重制或改作 | 同上 |
| AI 克隆名人、主播、角色的声线，或「神似某某」的模仿 | 人格权和平台条款（ElevenLabs 等禁止冒充） | ElevenLabs 条款见上 |
| YouTube Audio Library 中的「标准授权」曲目 | 条款限制只能用于视频内容，不能单独分发 | 见第 1 节 |
| Freesound 的 CC BY-NC 素材、OGA 的 BY-SA / GPL 素材（闭源商业版） | 禁止商用，或带传染性 | 见第 1 节 |
| 来源不明的「免费音效包」或网盘合集 | 无法证明授权链（例如有人转载的 Sonniss 包，本身就违反了它的再分发禁令） | — |
| 真实品牌名、品牌口号、店内广播（例如真实连锁手摇饮的点单铃声或 slogan） | 商标和著作权风险；场景要真实，但**品牌必须虚构** | — |

**可以做的替代方案**：让我们自己的配音员**原创**同类笑点（「来 250 杯！」本身就是原创梗），或把台词写成「致敬但不引用」的样子。

---

## 4. 推荐给本项目的组合方案

### 阶段 0：原型（现在至可玩 Demo）——NT$0
- **音效**：WebAudio 程序化合成（已在 `audio.js` 契约中），零文件。
- **语音**：Web Speech API（zh-TW，没有就用 zh-CN；英文用 en-US），按 style 调参，配合 `bleep` 消音玩法。
- **音乐**：暂不加，或用 WebAudio 合成一个简单的快板循环。

### 阶段 1：软上线 / 投稿版——约 NT$0–5,000
- **音效**：Kenney CC0（Impact、Interface、Jingles）加 Sonniss GDC（冰块、杯子、拍桌、人群）加 Freesound CC0（嘘声、欢呼）。
- **音乐**：1–2 首 Kevin MacLeod（CC BY，署名），或 Pixabay / Mixkit 免署名曲目。
- **语音**：Azure 神经 TTS 的 zh-TW 声线（加 en-US 声线）**预生成**全部台词。台词约 100 位顾客 × 2 句，加系统台词，共数千字。按字符计费的成本很低（**具体单价未核实，请以 Azure 官方价格页为准**）。也可以用 ElevenLabs 付费方案（Starter 约 US$5/月，1–2 个月即可生成完毕）。

### 阶段 2：正式上架版（推荐）——约 NT$40,000–120,000
| 项目 | 估算 | 依据 |
|---|---|---|
| 中文店员主配音（台湾配音员，约 3,000–5,000 字的短句，含大量情绪变化，**游戏用途永久买断**） | NT$20,000–60,000 | PRO360 / 出任务行情：每 500 字 NT$2,000–5,000、每分钟 NT$4,000–5,000；短句多、情绪多，通常按句或按小时加价（**估算**） |
| 中文顾客群杂（2–3 位配音员，或用 TTS） | NT$0–15,000 | 估算 |
| 英文店员配音（Voices.com / Fiverr，Non-Broadcast 永久买断，或 Fiverr 加购 Commercial Use License） | US$300–1,200（约 NT$10,000–38,000） | 估算，**未核实**市场单价 |
| 委托原创 BGM 1–2 首（买断） | NT$5,000–20,000，或改用 Incompetech（0 元加署名，或约 US$30–40/首免署名，**价格未核实**） | 估算 |
| 音效 | NT$0（CC0 / Sonniss / 自制） | — |

> 所有金额都是**粗估**，仅用于立项预算，签约前以报价单为准。

### 落地清单
1. 新建 `game/assets/audio/`（正式版再建，原型不需要）和 `docs/licenses/ASSETS.csv`。
2. 每个音频文件都做到「可追溯」：来源 URL、授权、日期、截图。
3. 「关于」页加署名：Kevin MacLeod 的完整署名格式、致谢 Kenney 和 Sonniss、AI 语音披露（如使用）。
4. 内购和 DLC 只放自制、CC0 或委托买断的声音。

---

## 5. 未核实事项（上架前必须人工补查）
- Mixkit License 原文中关于「再分发 / 模板 / 内购」的具体措辞。
- YouTube Audio Library 官方条款原文（support.google.com 被阻断）。
- Incompetech Standard License 的官方价格。
- Google Cloud TTS 关于「预生成音频随应用分发」的条款原文。
- Azure Product Terms 关于 TTS 输出权利的原文条款，以及 zh-TW 声线清单和单价。
- Amazon Polly 是否有台湾腔中文声线。
- 美国 SAG-AFTRA 游戏配音的费率。
- 各操作系统内置 TTS 声线能否录制再分发（我们**不**这么做，只做记录）。

## 来源
- Kenney Support（CC0）：https://kenney.nl/support ・ Impact Sounds：https://kenney.nl/assets/impact-sounds ・ Interface Sounds：https://kenney.nl/assets/interface-sounds ・ Voiceover Pack：https://kenney.nl/assets/voiceover-pack
- OpenGameArt FAQ：https://opengameart.org/content/faq
- Freesound FAQ：https://freesound.org/help/faq/
- Pixabay Content License：https://pixabay.com/service/license-summary/ ・ 条款：https://pixabay.com/service/terms/ ・ FAQ：https://pixabay.com/service/faq/
- Mixkit License：https://mixkit.co/license/ ・ Mixkit 官方说明：https://mixkit.co/llm-info/
- Sonniss GDC 2026：https://gdc.sonniss.com/ ・ 授权：https://sonniss.com/gdc-bundle-license/ ・ 档案：https://sonniss.com/gameaudiogdc/
- YouTube Audio Library：https://support.google.com/youtube/answer/3376882
- Incompetech 授权：https://incompetech.com/music/royalty-free/licenses/ ・ FAQ：https://incompetech.com/music/royalty-free/faq.html
- ElevenLabs：https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform
- Azure Speech 游戏开发：https://learn.microsoft.com/en-us/azure/ai-services/speech-service/gaming-concepts ・ Q&A：https://learn.microsoft.com/en-nz/answers/questions/5987029/can-audio-generated-with-azure-text-to-speech-be-p
- Amazon Polly FAQ：https://aws.amazon.com/polly/faqs/
- Google Cloud TTS：https://docs.cloud.google.com/text-to-speech/docs/basics ・ https://discuss.google.dev/t/text-to-speech-api-license/187973
- Voices.com 授权说明：https://www.voices.com/help/knowledge/faq/Understanding-Licensing
- Fiverr 配音授权附加项：https://community.fiverr.com/forums/topic/320178-the-new-commercial-rights-1-year-and-full-broadcasting-rights-1-year-add-ons/
- PRO360 配音价格：https://www.pro360.com.tw/price/dubbing ・ 出任务配音价格：https://www.tasker.com.tw/price/voice-over
- 台湾著作权法：https://law.moj.gov.tw/LawClass/LawAll.aspx?PCode=J0070017 ・ 智慧局：https://www.tipo.gov.tw/tw/copyright/701-21230.html
- MDN SpeechSynthesis：https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
