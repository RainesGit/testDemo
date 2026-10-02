# 《来250杯！》英文配音稿 · 定稿（"250 Cups!" English VO Script, Final v2.0）

> 依据：`docs/lines-zh.md`（v3 定稿）、`docs/voice/voice-bible.md`（配音导演手册），以及英语母语喜剧编剧评审（v1.0 → v2.0 全部修改已并入）。
> 本稿合并了原 `en-1-50` 与 `en-51-100` 两份初稿，是英文录音和字幕的唯一依据。

---

## 使用说明

### 1. 英文版250方案摘要（v2.0，已同步到手册第5节）

中文里“二百五”是骂人的话，英文里250只是一个数字。英文版用三层办法让美国玩家听懂，而且**静音玩也看得懂**：

| 层 | 做法 | 用在哪 | 例 |
|---|---|---|---|
| ① 口误＋删除线字幕（主梗） | 店员把 **quarter-wit**（“四分之一个脑”，比 half-wit 半吊子还少一半）**完整说出来**，咳一声，再一本正经改口成“a quarter… of a thousand”（250＝1000的四分之一）。字幕先显示 ~~quarter-wit~~ 被划掉，再显示改口内容 | 只限：招牌流程 SIG04（＝C047）、收键3段慢动作 SIG09、传说台词、每日隐藏台词 | A quarter-wit— ／／(cough) a quarter… of a **thousand.** |
| ② “Out of a thousand”（日常层，不用学） | 250/1000＝25分＝F，美国玩家一听就懂，和“Failed.”（C045）“First passing grade today.”（C046）连成“打分”系列 | 普通250暗骂台词 | "Two-fifty." ／／Out of a thousand. ／Booked.（C098） |
| ③ “a two-fifty”评级名词 | 美国人本来就用数字给人打分（a ten, a zero）。反复出现后，“two-fifty”本身就成了评语 | C033变体、C084、C091、群众walla | Two-fifty-cup club only. ／／…Eh. ／Close enough.（C091） |

辅助技巧：
- **Zero 家族**（顺带等于“you're a zero”）：C044 “You're missing a zero.”、C065 “Two. Five. ／／…Zero.”
- **划掉一杯**：C049 把251划成250，全程不说破。
- **硬币**：C064 顾客倒出一堆 quarters（25美分），可选尾巴 “…Fitting.”
- **其他 -wit**：C057 的 “eighth-wit”（125＝1000的八分之一）。-wit 系列永远不和 slow、special、brain cell、IQ 叠用。
- **群众walla**（取餐日、保龄滚群录追加）：“Classic TWO-FIFTY!” ／ “That's a TWO-FIFTY!”（不用 he/she，不写性别）。
- **商店页与预告片片尾卡**（不进语音）：*In Chinese slang, '250' means idiot. Our clerk will not be explaining further.*
- 店员永远不解释，也不笑。“Exactly you”这类说破的句子一律不用。

**UI 工单**：SIG04、SIG09、传说与隐藏台词的字幕必须支持删除线样式（~~quarter-wit~~），先显示被划掉的词，约0.4秒后接改口文本。

### 2. 标注符号

| 符号 | 含义 |
|---|---|
| ／ | 短停 0.2–0.3秒 |
| ／／ | 长停 0.6–1.0秒，让沉默本身成为笑点 |
| **粗体** | 重音 |
| ⇢ | 从爆骂或兴奋**瞬间切回正经**，落到 L1 |
| ⤴ | 从破功（脸红、感动、心软）**瞬间恢复凶**，一律落到 **L3** |
| ｜ | 切点。前面是“爆头”，必须≤0.6秒且保证播完；后面可被下一位截断 |
| [哔:…] | 后期消音范围。演员照念原音；“哔——”开关打开时只哔方括号内 |
| (…) | 动作，不念。动作的静音由动画处理，不计入 Target sec |
| 〔SFX:…〕 | 音效空档 |
| 〈n.ns〉 | 目标时长，只算有声部分，容差±10% |
| 〔慢〕〔常〕〔快〕〔连〕 | 语速：≤3 / 4–5 / 6–7 / 8+ 音节每秒 |

**v2.0 时长规则（QA 已逐句复核）**：爆头在〔快〕下≤4音节，在〔常〕下≤3音节。Pace 列标的是整句主体速度；Pace 为〔慢〕的句子，爆头仍按〔常〕念完，慢的是切点之后。唯一例外是 C047（＝SIG04）：它在开场一镜到底的招牌流程中，输入冻结，不会被截断。

**强度标法**：`L2→L4` 逐渐升；`L5 ⇢ L1` 瞬间切；`破功L1⤴L3` 先破功再恢复凶。

**按键英文名**：滚＝SCRAM，闭嘴＝ZIP IT，收＝BOOKED。文件ID：`C001_main`，变体 `C001_var`，消音版加 `_bp`。

### 3. 风格对应表（Alt take 前的〔〕标的是变体风格）

| 中文风格 | 英文做法 | 典型句 |
|---|---|---|
| 明骂 | "[KEYWORD] your MOM!"（约60%）或 "X my ASS"、"Don't you X me!"、复读式（约40%）。关键词先埋在顾客原话里并重读 | **CHANGE** [哔:your MOM]! |
| 嫌弃 | 短问句＋美式具体夸张 | It's **one page**. You reading a treasure map? |
| 冷静 | 句号多、不抬头、零情绪 | Nope. Your turn's **over**. Next. |
| 一本正经 | 企业客服话术当武器，第三拍最平 | Today's special: you, leaving. |
| 真人反应 | 动作和沉默做主角，台词越少越好 | (phone rings) …／／I can **see** you. |
| 中二 | 动漫英配腔／摔角主持腔，力量只来自柜台、黄金比例和价格 | The only thing free in this world… is my **EYE ROLL!** |
| 算账 | 规则当场套回顾客身上，越算越贵 | No sugar? That's **twenty** extra. |
| 250暗骂 | 见上方三层方案，不说破 | Two-fifty-one? (crosses one out) ／／**Two-fifty.** |
| 反差 | 破功一秒 ⤴ 立刻恢复凶 | (blushes) ⤴ Your crush can **wait.** |

### 4. 用词规则速查（v2.0 新增）

- **SCRAM**：按键名和 L3–L5 的喊法保留。L1–L2 句尾轮换 Out / Bye / Beat it / Shoo / Go，SCRAM 在 L1–L2 句尾占比≤60%（本稿实际约45%）。
- **限量**：“Do the math”只出现在 C032、C038、SBR29；“waits in line too”只出现在 C088、C090；“Suits you”本稿为0。
- **your-MOM 关键词**：安全词表新增 **ADD、HALF**；软禁用（不再用）**SIT、SPLIT、ASK**。
- **不用品牌名**：不出现 Yelp、Venmo 等商标。
- **导演与选角备注**：C004 不用方言腔读，不即兴加“catch these hands”；V7（C085、C086）与 C099 的顾客声线、美术必须中性；任何内部文件名、美术需求、营销素材都不得出现“Karen”。

---

## 100位顾客英文配音表

### 一、犹豫磨叽类

| ID | Customer | Context (中文说明) | Customer line | Clerk line (with delivery marks) | Intensity | Pace | Target sec | Alt take line | Bleep | 笑点说明 |
|---|---|---|---|---|---|---|---|---|---|---|
| C001_main | #1 The Hesitator 犹豫哥 | 键：SCRAM。真人反应（原版）。只发出“嗯……”，什么也没点 | Ummm… | (stares for three seconds, deep breath) Still thinking?｜**SCRAM!** | L1→L4 | 〔快〕 | 〈1.0s〉 | 〔冷静〕(checks watch) Your one second's up.｜／Out. — L1〈1.3s〉 | — | 盯三秒的沉默交给动画，有声部分就是一问一砸 |
| C002_main | #2 Menu Scholar 菜单研究员 | 键：SCRAM。嫌弃。菜单只有一面，他看得像在考试 | There's so much on the menu, gimme a sec… | It's **one page**.｜You reading a treasure map? ／Scram. | L2 | 〔快〕 | 〈2.2s〉 | 〔真人反应〕(snatches the menu, flips it over) …Done reading.｜／Next. — L1〈1.2s〉 | — | 一页菜单被读成藏宝图，夸张得很具体 |
| C003_main | #3 Recommend-Me 推荐狂（标杆） | 键：SCRAM。一本正经。问店员推荐什么。v2.0 把“recommendation”换成菜单腔“special”，爆头从7音节缩到4音节 | What do you recommend? | Today's special:｜you, leaving. ／Runner-up: you, leaving **faster.** | L1 | 〔快〕 | 〈2.2s〉 | 〔冷静〕(chin-points behind them) I recommend｜the person behind you. — L1〈1.6s〉 | — | 用餐厅“今日特餐”的口吻宣布赶人，第三拍要念得最平 |
| C004_main | #4 Best-Cup Seeker 最好喝追问者 | 键：BOOKED。中二。点520杯，还问哪杯最好喝。导演备注：不用方言腔读，不即兴加“catch these hands” | Five-twenty cups! Which one's the best? | (slams counter, rises) **EVERY** cup!｜I shook them **ALL!** ／With **THESE.** ／**HANDS!** | L5 | 〔慢〕→〔快〕 | 〈2.2s〉 | 〔冷静〕All of them.｜／Next question. — L1〈1.2s〉 | — | 摇饮料被喊成少年漫的必杀技，“THESE. HANDS.”可以截图 |
| C005_main | #5 Can't Decide 选择困难 | 键：BOOKED。冷静。100杯，在珍奶和翡翠柠檬之间犹豫 | A hundred cups! Milk tea or Jade Lemon… | (taps the register twice) Both.｜A hundred **each.** ／Two months. ／You're welcome. | L1 | 〔常〕 | 〈2.0s〉 | 〔算账〕Thinking's｜ten bucks a second. ／You're at fifty. — L2〈1.8s〉 | — | 店员直接替他做了一个更贵的决定，还要他说谢谢 |
| C006_main | #6 Phone-a-Friend 电话求救 | 键：SCRAM。真人反应。排到了才打电话问朋友要喝什么 | Hold on, lemme ask my friend what they want… | (snatches the phone) Hello?｜…／Uh-huh. ／Your friend **passes.** (hangs up) ／Scram. | L1→L3 | 〔常〕 | 〈2.4s〉 | 〔冷静〕Your friend｜can get in line. ／You? ／Out. — L2〈1.6s〉 | — | 抢电话、挂电话，店员替朋友做了决定 |
| C007_main | #7 Zoned Out 轮到才回神 | 键：SCRAM。冷静。轮到他了才回过神 | Huh? Is it my turn? | Nope.｜Your turn's **over.** ／Next. | L1 | 〔常〕 | 〈1.4s〉 | 〔真人反应〕Huh?｜Thirty minutes in line… ／for the **vibes?** — L2〈2.0s〉 | — | 一句“Nope”把他的这一轮直接取消 |
| C008_main | #8 After-You 礼让大师 | 键：SCRAM。一本正经。客气地让后面的人先点。v2.0 去掉 karma（宗教相关） | Oh, you go ahead, they can order first… | Generous.｜／Be generous… from the **back.** | L1 | 〔常〕 | 〈1.6s〉 | 〔冷静〕Sure.｜Next one's up. ／You go back. ／Keep going. ／Keep going. — L1〈2.4s〉 | — | 夸他大方，然后让他到队尾继续大方 |
| C009_main | #9 The Switcher 改单王 | 键：SCRAM。明骂。绿茶改红茶再改奶茶，关键词 CHANGE | Green tea… no, **CHANGE** it, black tea… **CHANGE** again, milk tea… | **CHANGE** [哔:your MOM]!｜Change again and you can change **shops!** | L5 | 〔快〕 | 〈1.8s〉 | 〔算账〕Each change｜adds a month. ／Two changes? ／See you in **four.** — L2〈2.0s〉 | 是：your MOM | 顾客说了两遍的动词被当场还给他，后半句接着用同一个词 |
| C010_main | #10 Comparison Shopper 比较控 | 键：ZIP IT。一本正经。问翡翠柠檬和柠檬绿差在哪 | What's the difference between Jade Lemon and Lemon Green? | (points at the menu) One's on the **left.**｜／One's on the **right.** ／Order. | L1 | 〔常〕 | 〈2.0s〉 | 〔冷静〕Difference?｜You haven't ordered. — L1〈1.4s〉 | — | 用菜单上的位置回答口味问题，答得一点没错 |

### 二、甜度冰块类

| ID | Customer | Context (中文说明) | Customer line | Clerk line (with delivery marks) | Intensity | Pace | Target sec | Alt take line | Bleep | 笑点说明 |
|---|---|---|---|---|---|---|---|---|---|---|
| C011_main | #11 Sugar Picker 调甜度 | 键：ZIP IT。冷静。问能不能自选甜度（顾客刻意不说 adjust，ADJUST your MOM 留给招牌场景） | Can I pick my sugar level? | Sure.｜Your options: ／golden ratio. ／／…Great choice. | L1 | 〔常〕 | 〈2.0s〉 | 〔真人反应〕(rips up the sugar chart) …Chart's gone.｜／No more picking. — L1〈1.6s〉 | — | 可以选，只是选项只有一个，最后还夸他选得好 |
| C012_main | #12 Less-Ice Crew 少冰党（标杆） | 键：ZIP IT。一本正经。要少冰，重读 LESS | Can I get **LESS** ice? | Less ice?｜The ice showed up to **work.** ／You want me to do **layoffs?** | L1 | 〔常〕 | 〈2.4s〉 | 〔明骂〕**LESS** [哔:your MOM]!｜Full ice tastes better! — L5〈1.6s〉 | 变体是：your MOM | 把冰块当成员工，少冰就是裁员，用的是职场语言 |
| C013_main | #13 No-Ice Crew 去冰党 | 键：ZIP IT。中二。要完全去冰。原文“杀”改成 ERASE，去掉暴力感 | No ice. | (hand over face) Ice…｜is the **SOUL.** ／You want me to… ／**ERASE** it?! ／**NEVER!** | L4→L5 | 〔慢〕→〔快〕 | 〈2.4s〉 | 〔嫌弃〕Hold the ice?｜／Hold your spot. ／In the **back.** — L2〈1.6s〉 | — | 用动漫腔演“冰块有灵魂” |
| C014_main | #14 Light-Ice Crew 微冰党 | 键：ZIP IT。真人反应。只要一点点冰 | Just light ice. | Light ice?｜(turns, yells to the back) **FULL ICE!** ／Customer's **OVERHEATING!** | L1→L4 | 〔快〕 | 〈1.8s〉 | 〔冷静〕(nods) Light ice.｜／Heard. ／Regular ice. — L1〈1.6s〉 | — | 店员转头朝后场喊单，把要求反过来报 |
| C015_main | #15 Half-Sugar Crew 半糖党 | 键：BOOKED。一本正经。100杯，要半糖。v2.0 切点前移到“Life's bitter” | A hundred cups, half sugar. | Life's bitter｜enough. ／**Full** sugar. ／You're welcome. | L1 | 〔常〕 | 〈1.8s〉 | 〔反差〕(eyes soften) …Rough week, huh?｜⤴ (instantly mean) **FULL SUGAR!** ／**NEXT!** — 破功L1⤴L3〈2.0s〉 | — | 用人生道理拒绝半糖，念得像在关心对方 |
| C016_main | #16 No-Sugar Crew 无糖党 | 键：ZIP IT。算账。要无糖。v2.0 爆头缩短 | No sugar, thanks. | No sugar?｜That's **twenty** extra. ／／(customer blinks) …Sugar-removal fee. | L2 | 〔常〕 | 〈2.2s〉 | 〔中二〕(clutches chest, staggers back) You've wounded…｜the **GOLDEN RATIO…** ／**FULL SUGAR!** — L4〈2.4s〉 | — | 少放东西反而多付钱，“拆糖费”说得像真的收费项目 |
| C017_main | #17 Hot-Drink Crew 热饮党 | 键：ZIP IT。明骂。要热饮，关键词 SWITCH | Can you **SWITCH** it to hot? | **SWITCH** [哔:your MOM]!｜It's ninety-five out. ／Give it a minute. | L5 | 〔快〕 | 〈1.9s〉 | 〔一本正经〕Sure. (points outside)｜Stand out there. ／Two months, it's hot. — L1〈2.0s〉 | 是：your MOM | 热饮的办法是拿到外面晒，华氏95度一分钟就热 |
| C018_main | #18 Sore Throat 喉咙痛 | 键：ZIP IT。嫌弃。说喉咙痛，不要太冰 | Not too cold, my throat hurts. | Sore throat?｜Doctor's orders: ／**zip it.** | L2 | 〔快〕 | 〈1.5s〉 | 〔真人反应〕(cups an ear) …Huh?｜／Can't hear you. ／Regular ice. — L1〈1.6s〉 | — | “闭嘴”被包装成医嘱，同时就是按键的喊法 |
| C019_main | #19 On-the-Side 糖冰分装 | 键：ZIP IT。冷静。要糖和冰分开装 | Can I get the sugar and ice on the side? | Sure.｜Sugar's yours. Ice is yours. ／The **tea's** mine. | L1 | 〔常〕 | 〈2.0s〉 | 〔一本正经〕(shakes head) No.｜The golden ratio is **family.** ／We don't split up family. — L1〈2.4s〉 | — | 分开装照做了，只是把茶留给了店员自己 |
| C020_main | #20 Percent Nerd 百分比控 | 键：BOOKED。真人反应。点251杯，要37%甜度（美国店常见0/25/50/75/100%档） | Two-fifty-one cups, thirty-seven percent sugar? | What?｜Thirty-seven? (mashes the calculator forever) ／…No button for that. ／Golden ratio. ／Booked. | L1 | 〔慢〕 | 〈2.4s〉 | 〔冷静〕Sure.｜Thirty-seven percent… ／of **full** sugar. — L1〈1.8s〉 | — | 计算器按了很久，最后答案还是黄金比例 |

### 三、加料改料类

| ID | Customer | Context (中文说明) | Customer line | Clerk line (with delivery marks) | Intensity | Pace | Target sec | Alt take line | Bleep | 笑点说明 |
|---|---|---|---|---|---|---|---|---|---|---|
| C021_main | #21 Add-Boba 加珍珠（标杆） | 键：ZIP IT。一本正经。问能不能加珍珠，重读 ADD（ADD 已进安全词表） | Can I **ADD** boba? | Sure.｜Add it, and it's a **different** drink. ／That drink's sold out. | L1 | 〔常〕 | 〈2.4s〉 | 〔明骂〕**ADD** [哔:your MOM]!｜The original is **PERFECT!** — L5〈1.6s〉 | 变体是：your MOM | 偷换概念：加了料就是另一杯，而那一杯永远卖完了 |
| C022_main | #22 More Boba 珍珠多一点 | 键：ZIP IT。中二。要多放珍珠 | Can I get more boba? | (shields the boba pot) Every pearl…｜has a **SERIAL NUMBER!** ／**NO ONE** takes extra! | L4→L5 | 〔慢〕→〔快〕 | 〈2.4s〉 | 〔一本正经〕Counted.｜Every pearl. ／Want more? ／Count them yourself. — L1〈2.0s〉 | — | 用守护宝物的气势守一锅珍珠，“编号”这个细节让人想截图 |
| C023_main | #23 The Swapper 换料 | 键：ZIP IT。冷静。要把椰果换成仙草 | Can I swap coconut jelly for grass jelly? | Sure.｜Swapping to— ／／no. | L1 | 〔常〕 | 〈1.4s〉 | 〔嫌弃〕Swap?｜Swap **places.** ／Back of the line. — L2〈1.4s〉 | — | 说“可以”说到一半，长停后改成“不行” |
| C024_main | #24 Everything-On-It 全加 | 键：BOOKED。反差。100杯，所有料都加。v2.0 标注更正：切回冷淡用⇢（落到L1） | A hundred cups! **ALL** the toppings! | (eyes light up) You **get** it!｜You actually **GET** it! ⇢ (instantly cold) …Two months. | L4 ⇢ L1 | 〔快〕→〔慢〕 | 〈2.6s〉 | 〔算账〕Four toppings.｜Ten bucks each. ／A hundred cups. ／／…That's four grand. — L2〈2.4s〉 | — | 店员终于遇到懂行的人，开心一秒就恢复冷淡 |
| C025_main | #25 Boba Remover 挑珍珠 | 键：ZIP IT。真人反应。要把珍珠挑掉 | Can you take the boba out? | (looks at the boba, then at the customer) …What'd they **do**｜to you? | L1 | 〔慢〕 | 〈1.3s〉 | 〔冷静〕Sure.｜Pick them out yourself. ／One by one. ／**Outside.** — L1〈2.2s〉 | — | 店员真心替珍珠抱不平 |
| C026_main | #26 Oat-Milk Ask 燕麦奶 | 键：ZIP IT。嫌弃。问有没有燕麦奶。v2.0 去掉 brunch（生活方式／阶层刻板印象） | Do you have oat milk? | Oat milk?｜／Cute. ／Whole milk. ／Next. | L2 | 〔快〕 | 〈1.6s〉 | 〔冷静〕No.｜／We have a **line.** ／Want that? — L1〈1.6s〉 | — | 一个“Cute.”就把燕麦奶打发了，直接换成全脂 |
| C027_main | #27 Pudding Halver 布丁切半 | 键：ZIP IT。明骂。要半颗布丁，关键词改为 HALF（SPLIT 进软禁用表） | Can I get **HALF** a pudding? | **HALF** [哔:your MOM]!｜Pudding comes **WHOLE!** | L5 | 〔快〕 | 〈1.6s〉 | 〔一本正经〕Sure.｜Half now. ／Other half in two months. — L1〈1.8s〉 | 是：your MOM | 最短的公式，理由只有一个：布丁就是整颗的 |
| C028_main | #28 Strong-Tea Fan 浓茶 | 键：ZIP IT。嫌弃。要茶浓一点。v2.0 去掉直译的“把脉” | Can you make the tea stronger? | Any stronger,｜it needs a **prescription.** | L2 | 〔快〕 | 〈1.5s〉 | 〔真人反应〕(sighs, audible)｜…The coffee place is next door. — L1〈1.6s〉 | — | 浓到要医生开处方才能买 |
| C029_main | #29 Extra Lemon 柠檬多放 | 键：BOOKED。真人反应。100杯，要多放几片柠檬 | A hundred cups, extra lemon slices. | (bites a whole lemon, straight-faced) …Sour｜enough. ／Booked. | L1 | 〔慢〕 | 〈1.2s〉 | 〔中二〕(gazes into the distance) Each lemon slice…｜has its own **DESTINY!** — L4〈2.0s〉 | — | 店员咬整颗柠檬面不改色，笑点在动作，台词越平越好 |
| C030_main | #30 Mad Scientist 自创配方 | 键：ZIP IT。嫌弃。要红茶加绿茶加奶加柠檬 | Black tea plus green tea plus milk plus lemon. | All four?｜(slides it back) ／That's **dishwater.** ／Next. | L2 | 〔快〕 | 〈1.6s〉 | 〔250暗骂〕(taps calculator) Four add-ons…｜comes to two-fifty. ／／Out of a thousand. ／Checks out. — L1〈2.6s〉 | — | 主台词直接叫它洗碗水；变体用“满分一千拿250”暗骂 |

### 四、贪小便宜类

| ID | Customer | Context (中文说明) | Customer line | Clerk line (with delivery marks) | Intensity | Pace | Target sec | Alt take line | Bleep | 笑点说明 |
|---|---|---|---|---|---|---|---|---|---|---|
| C031_main | #31 Discount Hunter 打折 | 键：BOOKED。中二。点250杯，问能不能打折。v2.0 缩短，去掉与C077重复的“bowed” | Two-fifty cups—can I get a discount? | (grips ticket) Our prices…｜are **UNDEFEATED!** ／**BOOKED!** | L5 | 〔慢〕→〔快〕 | 〈1.8s〉 | 〔一本正经〕(slides a calculator over) Discount｜applied: ／zero percent. ／Booked. — L1〈1.8s〉 | — | 价格被喊成从没输过的拳王 |
| C032_main | #32 BYO Cup 自备杯 | 键：BOOKED。算账。100杯，问自备杯能不能折价 | A hundred cups—do I get the reusable cup discount? | BYO cup:｜five off. ／Cup-washing fee: **fifty.** ／Do the math. | L2 | 〔常〕 | 〈2.4s〉 | 〔冷静〕Sure.｜Leave the cups. ／Pick them up in two months. — L1〈2.0s〉 | — | 折价是真的，但洗杯费是折价的十倍 |
| C033_main | #33 Bucket Guy 自备水桶 | 键：SCRAM。真人反应。说自备杯，拿出一个水桶 | I brought my own cup! (holds up a bucket) | (stares at the bucket, then at the customer) …Is there a **fire?**｜／Beat it. | L1→L3 | 〔常〕 | 〈1.4s〉 | 〔250暗骂〕(eyes the bucket) …Fits two-fifty.｜(eyes the customer) ／／Classic two-fifty. — L1〈2.0s〉 | — | 先盯桶再盯人，一句消防梗；变体把“two-fifty”当评级名词暗骂 |
| C034_main | #34 Sample Seeker 试喝 | 键：SCRAM。明骂。想先试一口，关键词 PREVIEW | Can I get a **PREVIEW?** Just a little? | **PREVIEW** [哔:your MOM]!｜The premiere's in **two months!** | L5 | 〔快〕 | 〈1.8s〉 | 〔冷静〕A sample?｜This drink exists in two months. ／Want to sample the **air?** — L1〈2.4s〉 | 是：your MOM | 试喝说成电影预告，首映就是两个月后的取餐日 |
| C035_main | #35 Nine Stamps 集点差一点 | 键：SCRAM。反差。集了9点，求送第10点。v2.0 去掉直译的“差一点就是差一点” | I've got nine stamps—just give me the tenth? | (stamp hovers… pulls back) Nine's｜a great number. ／Keep it. | L1 | 〔常〕 | 〈1.6s〉 | 〔冷静〕Nine? (rips up the card)｜／Start over. — L1〈1.2s〉 | — | 印章在半空心软了一秒又收回，嘴上还夸“9是个好数字” |
| C036_main | #36 Haggler 砍价 | 键：BOOKED。算账。520杯，撒娇求便宜 | Five-twenty cups, cut me a deal~? | A deal? Sure.｜(taps calculator) ／…Congrats. It's **more.** | L2 | 〔常〕 | 〈1.8s〉 | 〔嫌弃〕Haggle?｜This isn't a flea market. ／Booked. — L2〈1.6s〉 | — | 店员认真帮他算，算出来更贵，还恭喜他 |
| C037_main | #37 Extra Bag 多要袋子 | 键：ZIP IT。真人反应。多要一个袋子 | Can I get an extra bag? | (pulls out a bag, looks at it, puts it back) …Nah.｜／Thought about it. ／No. | L1 | 〔常〕 | 〈1.4s〉 | 〔冷静〕Bag's ten cents.｜／What're you even putting in it? — L1〈1.8s〉 | — | 动作做了全套，认真考虑过，最后还是不给 |
| C038_main | #38 Separate Bags 分开装 | 键：SCRAM。算账。50杯要分开装 | Fifty cups—can I get them bagged separately? | Ten bucks a bag.｜Fifty cups. ／Do the math! ／**SCRAM!** | L2→L4 | 〔快〕 | 〈2.0s〉 | 〔冷静〕Sure.｜Separate bags. ／Separate waits. ／Two months **each.** — L1〈2.2s〉 | — | 袋子钱比饮料还贵，算完立刻赶人 |
| C039_main | #39 BOGO Hunter 第二杯半价 | 键：BOOKED。冷静。点251杯，问有没有第二杯半价 | Two-fifty-one cups—any buy-one-get-one half off? | Yep.｜First cup's **double.** ／Booked. | L1 | 〔常〕 | 〈1.4s〉 | 〔250暗骂〕Yep.｜Every two-fiftieth cup's half off. ／／…Your number's very popular here. — L1〈2.6s〉 | — | 优惠是真的，只是第一杯先翻倍 |
| C040_main | #40 Freeloader 免费加料 | 键：SCRAM。中二。问加料能不能免费 | Can the toppings be free? | (slowly rises) Free?｜The only thing free in this world… ／is my **EYE ROLL!** | L4→L5 | 〔慢〕→〔快〕 | 〈2.6s〉 | 〔真人反应〕(turns to empty air) …They said free. (turns back)｜／Ha. ／Ha. ／Shoo. — L1→L3〈2.0s〉 | — | 用宣布终极奥义的气势宣布白眼免费 |

### 五、数量类

| ID | Customer | Context (中文说明) | Customer line | Clerk line (with delivery marks) | Intensity | Pace | Target sec | Alt take line | Bleep | 笑点说明 |
|---|---|---|---|---|---|---|---|---|---|---|
| C041_main | #41 One Cup 1杯 | 键：SCRAM。嫌弃。只点一杯 | One cup. | One cup?｜You stood in line for **ONE?** ／Scram. | L2 | 〔快〕 | 〈1.6s〉 | 〔一本正经〕One cup?｜Two months. ／Two-fifty? ／Also two months. ／Your call. — L1〈2.4s〉 | — | 店员不敢相信这么少，语气是“你认真的？” |
| C042_main | #42 Three Cups 3杯 | 键：SCRAM。真人反应。点三杯。v2.0 去掉 Yelp 品牌名 | Three cups. | Three cups…｜(turns, looks at the line) ／…They're writing a **one-star review.** ／About you. | L1 | 〔慢〕 | 〈2.4s〉 | 〔算账〕Three cups.｜Two months. ／Twenty days a cup. ／Worth it? — L2〈2.2s〉 | — | 后面排队的人正在给这位顾客打差评 |
| C043_main | #43 Fifteen Cups 15杯 | 键：SCRAM。嫌弃（原版）。点15杯 | Fifteen cups. | (doesn't even look) Too small.｜**SCRAM!** | L3 | 〔快〕 | 〈0.8s〉 | 〔冷静〕(doesn't look) Fifteen.｜／Next. — L1〈0.9s〉 | — | 招牌第二拍，看都不看就判了 |
| C044_main | #44 Twenty-Five 25杯 | 键：SCRAM。250暗骂。点25杯，差一个0就是250（Zero 家族） | Twenty-five cups. | Twenty-five?｜You're missing a **zero.** ／Go find it. | L1 | 〔常〕 | 〈1.8s〉 | 〔真人反应〕(lip twitches) …Twenty-five.｜／One zero away from your **real** number. — L1〈2.4s〉 | — | 数学暗骂，同时听起来像“你是个zero” |
| C045_main | #45 Fifty Cups 50杯 | 键：SCRAM。冷静。点50杯（“打分”系列） | Fifty cups. | (doesn't look) Fifty.｜／**Failed.** ／Next. | L1 | 〔常〕 | 〈1.2s〉 | 〔嫌弃〕Fifty… (sighs, audible)｜／So close. ／Bye. — L2〈1.6s〉 | — | 杯数被当成考试分数打，判不及格 |
| C046_main | #46 One Hundred 100杯 | 键：BOOKED。一本正经。点100杯，今天第一个及格的（“打分”系列） | A hundred cups. | A hundred… (ticks a box in a tiny notebook)｜／First passing grade today. ／Booked. | L1 | 〔常〕 | 〈2.2s〉 | 〔反差〕(almost smiles) …Ahem.｜⤴ It's fine. ／**Booked.** — 破功L1⤴L3〈1.4s〉 | — | 及格有正式的记录流程，就像真的在考核 |
| C047_main | #47 Two-Fifty 250杯（原版） | 键：BOOKED。250暗骂。＝SIG04，招牌流程起点，接SIG05。完整说出 quarter-wit。字幕：~~quarter-wit~~（删除线）→ “a quarter… of a thousand.” 招牌流程中输入冻结，不受爆头时长限制 | Two-fifty! | (suddenly calm, professional) Okay. ／**Two-fifty.**｜A quarter-wit— ／／(cough) a quarter… of a **thousand.** ／Of what? | L1 | 〔慢〕 | 〈2.4s〉 | 〔反差〕(eyes well up) Finally…｜⤴ (instantly cold) Two-fifty of **WHAT?** ／Spit it out! — 破功L1⤴L3〈2.0s〉 | — | 完整的口误加删除线字幕，静音也看得懂；改口改得一本正经 |
| C048_main | #48 Two-Forty-Nine 249杯 | 键：SCRAM。中二。差一杯就是250（与试音稿第6句一致） | Two-forty-nine cups. | (shoots up) **ONE.**｜**CUP.** ／**SHORT!!** ／Come back **COMPLETE!** | L5 | 〔慢〕→〔快〕 | 〈2.4s〉 | 〔250暗骂〕Two-forty-nine?｜／…One short. ／You did that on **purpose.** — L1〈2.0s〉 | — | 三个单词三次爆破，像少年漫在喊招式名 |
| C049_main | #49 Two-Fifty-One 251杯（标杆） | 键：BOOKED。冷静。以为多一杯就不是250。v2.0 切点前移，爆头只留“Two-fifty-one?” | Two-fifty-one! | Two-fifty-one?｜(crosses one out) ／／**Two-fifty.** ／Booked. | L1 | 〔慢〕 | 〈1.6s〉 | 〔250暗骂〕Thought one extra cup｜would save you? ／…Two-fifty. ／Booked. — L1〈2.2s〉 | — | 划掉一杯，硬把他改回250，从头到尾不说破 |
| C050_main | #50 Five-Twenty 520杯 | 键：BOOKED。反差。点520杯；520在英文里没有“我爱你”，顾客原话自带告白动机。v2.0 标注更正为破功L1⤴L3 | Five-twenty cups! It's for my crush! | (blushes, one sec) ⤴ Your crush｜can **wait.** ／Two months. | 破功L1⤴L3 | 〔常〕 | 〈1.5s〉 | 〔嫌弃〕Confessions?｜Different shop. ／Booked. — L2〈1.4s〉 | — | 店员被告白气氛打动一秒，立刻把爱情也排进两个月 |

### 六、催单取餐类

| ID | Customer | Context (中文说明) | Customer line | Clerk line (with delivery marks) | Intensity | Pace | Target sec | Alt take line | Bleep | 笑点说明 |
|---|---|---|---|---|---|---|---|---|---|---|
| C051_main | #51 The Wait Asker（A·V3） | 键：ZIP IT。明骂（复读式，不用 your MOM）。问要等多久 | How long's the **WAIT?** | Wait? ／**WAIT?!**｜Two months! ／Ask again— **three!** | L2→L5 | 〔快〕 | 〈1.6s〉 | 〔冷静〕Two months.｜(stares, doesn't blink) ／／…You just waited three more seconds. — L1〈2.2s〉 | — | 先不敢相信地复读两遍，再顺手多加一个月 |
| C052_main | #52 The Pinger（B·V3） | 键：ZIP IT。算账。催单。v2.0 爆头缩短 | Is mine ready yet? | Ask again?｜(rips a calendar page) ／That's a month. | L2 | 〔常〕 | 〈1.3s〉 | 〔真人反应〕(slowly turns to the calendar… turns back) …No.｜— L1〈0.6s〉 | — | 当面撕掉一页月历，让“加一个月”有画面 |
| C053_main | #53 The Why Guy（B·V3） | 键：ZIP IT。一本正经。问为什么要两个月 | Why does it take two MONTHS? | The lemons｜are still **blooming.** | L1 | 〔常〕 | 〈1.3s〉 | 〔冷静〕Because you asked.｜／Now it's three. — L1〈1.4s〉 | — | 用农业时间回答，念得像店里的正式说明 |
| C054_main | #54 The Rusher（B·V3） | 键：SCRAM。嫌弃。我赶时间 | I'm in a hurry! | In a hurry?｜And you got in **LINE?** ／Leaving's faster. ／Bye. | L2 | 〔快〕 | 〈1.8s〉 | 〔中二〕(slowly clenches fist) The whole world can rush…｜the **GOLDEN RATIO** never speeds up! — L5〈2.4s〉 | — | 给他一个最省时间的方案：离开 |
| C055_main | #55 The Ticket Loser（B·V8） | 键：SCRAM。一本正经。号码牌弄丢了 | I lost my ticket… | (slowly tears off a new one) New ticket.｜Clock **resets.** ／Next. | L1 | 〔慢〕 | 〈1.6s〉 | 〔冷静〕No problem.｜We go by ticket, not by face. ／That cup's your donation. — L1〈2.4s〉 | — | 用标准作业流程的语气宣布两个月从头算起 |
| C056_main | #56 The Returner（A·V6） | 键：BOOKED。冷静（标杆）。两个月后真的来取餐。与 SIG08 共用同一个 take | I ordered two-fifty cups two months ago… | (flips the ledger) Two-fifty… ／found it. ／(slams it shut)｜**We start tomorrow.** | L1 | 〔慢〕 | 〈2.4s〉 | 〔反差〕(eyes go misty) You actually came back…｜⤴ (instantly hard) Hold your **number.** ／We'll call you. — 破功L1⤴L3〈2.4s〉 | — | 等了两个月才开始做，最后三个词是全作最大的反转 |
| C057_main | #57 The Half-Pickup（A·V2） | 键：SCRAM。250暗骂（标杆）。才一个月，想先拿一半。125＝1000的八分之一 | It's been a month. Can I grab **half** now? | Half?｜One twenty-five? That's an eighth-wit. ／／…Don't sell yourself short. | L1 | 〔常〕 | 〈2.4s〉 | 〔算账〕Sure.｜The half you take early? ／Plus a month. — L2〈1.8s〉 | — | 拿一半就只剩八分之一个脑，于是劝他“别看低自己”，等于确认他是完整的250 |
| C058_main | #58 The To-Go Order（B·V6） | 键：BOOKED。中二。520杯外带（只当大数字用，不用告白梗） | Five-twenty cups, to go. | (thrusts the ticket skyward) Five-twenty… **TO GO…**｜Two months from now— ／we **MEET AGAIN!** | L5 | 〔慢〕→〔快〕 | 〈2.4s〉 | 〔嫌弃〕(doesn't look up) Obviously.｜／You planning to live here two months? — L2〈2.0s〉 | — | 把一张普通取餐单喊成少年漫的决战约定 |
| C059_main | #59 The Reserver（B·V3） | 键：SCRAM。冷静。想预约明天下午三点（“下辈子”改 never，避开宗教） | Can I book tomorrow at three? | (flips to the very last page) …／／Next opening:｜**never.** ／Want me to pencil you in? | L1 | 〔慢〕 | 〈2.2s〉 | 〔真人反应〕(turns to the line) They want a *reservation.*｜(whole line laughs) ／…Shoo. — L1〈1.6s〉 | — | 宣布永远没空，再一本正经问要不要登记 |
| C060_main | #60 The Counter Caller（A·V3） | 键：SCRAM。真人反应（标杆）。人就站在柜台前打电话订饮料 | (phone to ear, standing right there) Hi, yeah, I'd like to order… | (counter phone rings, picks up, looks straight down) …／／I can **see** you.｜(hangs up) ／Scram. | L1→L3 | 〔慢〕 | 〈1.6s〉 | 〔250暗骂〕(answers) Thanks for calling.｜You're caller number **two-fifty.** ／Your call is important to us. ／Hold for two months. — L1〈3.0s〉 | — | 高柜台往下看的构图加上真人式沉默，适合短视频 |

### 七、付款收据类

| ID | Customer | Context (中文说明) | Customer line | Clerk line (with delivery marks) | Intensity | Pace | Target sec | Alt take line | Bleep | 笑点说明 |
|---|---|---|---|---|---|---|---|---|---|---|
| C061_main | #61 The Card Tapper（B·V6） | 键：BOOKED。一本正经。100杯，可以感应支付吗（够不到的是柜台高度，不是顾客身高） | A hundred cups. Can I tap to pay? | Sure.｜(hoists the card reader to the very top of the counter) …Tap it if you can reach it. | L1 | 〔常〕 | 〈1.8s〉 | 〔算账〕Card's an extra month.｜／Tap away. — L2〈1.4s〉 | — | 机器举到够不到的地方，嘴上还说“当然可以” |
| C062_main | #62 The QR Fumbler（A·V3） | 键：SCRAM。明骂。扫码付款一直扫不出来。v2.0 变体去掉“slower than you”（能力歧视） | Hold on, lemme **SCAN** this… it's not scanning… | **SCAN** [哔:your MOM]!｜(grabs a broom) ／Clean-up on aisle **YOU!** | L5 | 〔快〕 | 〈1.6s〉 | 〔冷静〕(glances at their phone) ／／…Your Wi-Fi's｜on a two-month wait too. — L1〈2.0s〉 | 是：your MOM | “扫码”和“扫地”的双关改成扫把加美国超市广播 |
| C063_main | #63 The Big Bill（B·V6） | 键：BOOKED。冷静。251杯，只有一张百元大钞 | Two-fifty-one cups. Can you break a hundred? | Can't break it.｜(hands over ticket) ／Here's your **change.** | L1 | 〔常〕 | 〈1.4s〉 | 〔算账〕A hundred,｜minus the change-making fee… ／exactly a hundred. — L2〈2.2s〉 | — | 拿号码牌当找零，零情绪 |
| C064_main | #64 The Coin Dumper（C级动作＋B语气音“Wait wait wait!”·V2） | 键：BOOKED。算账。哗啦倒出一大堆25分硬币。可选尾巴 C064_tag：(stares at the quarters) ／／…Fitting. L1〈0.6s〉（quarter 暗呼应 quarter-wit） | (dumps a mountain of quarters) A hundred cups! | You count 'em.｜／By the time you're done— ／pickup. | L2 | 〔常〕 | 〈1.6s〉 | 〔中二〕(stares at the coin mountain, rises slowly) This isn't money…｜it's your **OBSESSION!** ／**BOOKED—!** — L4→L5〈2.4s〉 | — | 数钱的时间刚好抵掉两个月的等待 |
| C065_main | #65 The Rewards Member（B·V5） | 键：ZIP IT。250暗骂。要求存进会员积分（Zero 家族） | Can you add it to my rewards? | Phone number? (types, reading aloud)｜Two. ／Five. ／／…Zero. ／That's **you** now. | L1 | 〔慢〕 | 〈2.4s〉 | 〔真人反应〕(slaps the ticket onto their forehead) Saved.｜— L1〈0.5s〉 | — | 逐位念到 Zero 停住，再把这串号码发给他当名字 |
| C066_main | #66 The Expenser（B·V3） | 键：ZIP IT。反差。要开报销收据。v2.0 标注更正：切回冷淡用⇢ | I need an itemized receipt. For work. | Company's paying? (eyes light up)｜⇢ (coughs, stone-faced) …**Two-fifty** minimum. | L4 ⇢ L1 | 〔快〕→〔慢〕 | 〈2.0s〉 | 〔算账〕Expensing adds a month.｜／Company money is still money. — L2〈2.2s〉 | — | 店员对“公司出钱”贪心了一秒，马上恢复，还开出250杯起跳 |
| C067_main | #67 The Splitters（A·V2） | 键：SCRAM。明骂（“my ASS”式，原生英语，不计入 your-MOM）。一群人要求分开付 | Can we **SPLIT** the check? | Split my [哔:**ASS!**]｜Whoever pays stays. ／Everyone else, **out!** | L4 | 〔快〕 | 〈1.8s〉 | 〔一本正经〕Sure.｜Split pay, split lines, ／split two months. Each. — L1〈2.2s〉 | 是：ASS | 骂完立刻端出一条店规，赶人有理有据 |
| C068_main | #68 The Pay-Later（B·V6） | 键：BOOKED。中二。520杯，想喝完再付。v2.0 去掉 Venmo 品牌名 | Five-twenty cups. Can I pay you after I drink 'em? | (slams the counter, rises) Drink first?!｜**PAY** first— ／then you're **WORTHY!** | L5 | 〔慢〕→〔快〕 | 〈1.8s〉 | 〔冷静〕Sure.｜You drink in two months. ／You pay now. — L1〈1.8s〉 | — | 付款顺序被喊成拜师资格考，worthy 是动漫英配的味道 |
| C069_main | #69 The Price Asker（A·V2） | 键：ZIP IT。算账（标杆，与试音稿第7句一致）。问这杯多少钱 | How much is this one? | Asking the price｜is ten bucks. ／／(customer opens mouth) …**Twenty.** | L2 | 〔常〕 | 〈2.2s〉 | 〔真人反应〕(points at the menu board, points at them, points at the board, silence)（无台词） — L1〈0s〉 | — | 规则当场套回顾客身上，第二拍是顾客自己张嘴触发的 |
| C070_main | #70 The Receipt Demander（B·V6） | 键：BOOKED。嫌弃。250杯，要收据 | Two-fifty cups. Receipt. | (tears a corner off the ticket, flicks it down) Receipt.｜／Happy? | L2 | 〔快〕 | 〈1.0s〉 | 〔中二〕(holds the ticket aloft) Receipt, rewards, pickup pass—｜**ALL IN ONE!** — L5〈2.2s〉 | — | 一小角纸片就算收据，往下一丢，非常轻蔑 |

### 八、拍照网红类

| ID | Customer | Context (中文说明) | Customer line | Clerk line (with delivery marks) | Intensity | Pace | Target sec | Alt take line | Bleep | 笑点说明 |
|---|---|---|---|---|---|---|---|---|---|---|
| C071_main | #71 The Photographer（B·V4） | 键：SCRAM。算账。可以拍照吗 | Can I take a pic? | Ten bucks a pic.｜Me in it, twenty. ／Flash on— ／scram. | L2 | 〔快〕 | 〈1.8s〉 | 〔冷静〕Sure. (turns around, back to the camera)｜／Go ahead. — L1〈1.0s〉 | — | 先报价，再加价，第三拍直接赶人 |
| C072_main | #72 The Shop Reviewer（A·V4） | 键：SCRAM。真人反应。网红开场对镜头介绍。v2.0 “fam”改“chat”（当下主播用语，和店员的“Chat,”呼应） | Hiii **chat!** Today we're reviewing the **MEANEST** boba shop in town! | (leans into their camera) Chat,｜they're gone in three. ／Three, two— ／**SCRAM.** | L1→L3 | 〔常〕 | 〈1.8s〉 | 〔一本正经〕Review noted.｜／／…One star. ／For you. — L1〈1.6s〉 | — | 店员抢过镜头当主持人，倒数没数完就赶人 |
| C073_main | #73 The Streamer（B·V4） | 键：ZIP IT。冷静。我在直播，跟大家打个招呼 | I'm live! Say hi to chat? | (to camera) Hi.｜Get in line. ／(hands phone back) | L1 | 〔常〕 | 〈1.2s〉 | 〔中二〕(grabs the phone) Chat… behold…｜the **LONGEST** line in town! — L5〈2.0s〉 | — | 整场直播的打招呼就这两个词 |
| C074_main | #74 The Story Poster（B·V4） | 键：SCRAM。嫌弃。发限时动态可以送珍珠吗。v2.0 改写，爆头缩到“A story?” | If I post a story, do I get free boba? | A story?｜Here's your story: ／**SCRAM.** | L2→L3 | 〔快〕 | 〈1.4s〉 | 〔算账〕One per like.｜(checks their phone) ／…Three likes. ／Three boba. ／Two months. — L2〈2.2s〉 | — | 他想拿内容换珍珠，店员当场给了他一个只有一个词的故事 |
| C075_main | #75 The Selfie Seeker（B·V4） | 键：BOOKED。反差。250杯，想和店员合照（只碰店员自己的头发，不碰顾客外貌）。v2.0 标注更正为破功L1⤴L3 | Two-fifty cups! Can I get a selfie with you? | (sneaks a quick hair fix) ⤴ (instantly stone-faced) …Fast.｜Two-fifty a pic. | 破功L1⤴L3 | 〔快〕 | 〈1.4s〉 | 〔250暗骂〕(dead-faced peace sign) Two-fifty a pic.｜／／…Seems fair. — L1〈1.8s〉 | — | 店员偷偷整理头发，被看到前就板回脸，然后按250收费 |
| C076_main | #76 The One-Star Threat（B·V7） | 键：SCRAM。一本正经。威胁要给一星差评。v2.0 去掉 Yelp，减少“waits in line too” | I'm writing you a one-star review! | Noted.｜／Your review will be ready ／in **two months.** | L1 | 〔常〕 | 〈1.8s〉 | 〔真人反应〕(whips out phone, jabs the screen) Already｜gave *you* negative one. — L1〈1.6s〉 | — | 连差评也要排两个月才能出餐 |
| C077_main | #77 The Comp Seeker（B·V4） | 键：SCRAM。中二。我是网红，可以免费招待吗 | I'm an influencer. Can I get it comped? | (gazes skyward) Comped?!｜I bow to no follower count… ／only to the **GOLDEN RATIO!** | L5 | 〔慢〕→〔快〕 | 〈2.2s〉 | 〔冷静〕Comped?｜One word: ／scram. — L1〈1.2s〉 | — | 用宣誓效忠的口吻拒绝业配，力量只来自黄金比例 |
| C078_main | #78 The Pic-and-Dash（C级：快门声＋脚步声） | 键：SCRAM。真人反应。拍完照转身就走 | (snaps photo, turns to leave)〔SFX:快门〕 | (grabs a megaphone) Pic-and-dash!｜／(whole line turns) ／／…Yeah. **You.** ／Scram. | L4→L1 | 〔常〕 | 〈2.0s〉 | 〔算账〕One pic, one cup.｜You took fifteen. ／Pay up. — L2〈1.6s〉 | — | 套用 dine-and-dash 造出 pic-and-dash，全场一起回头，公开处刑 |
| C079_main | #79 The Critic（A·V5） | 键：ZIP IT。明骂。美食评论家想先品回甘（APPRECIATE 听起来很正面，用一次正好） | Let me **APPRECIATE** the finish first… | **APPRECIATE** [哔:your MOM]!｜You don't even **HAVE** it yet! | L5 | 〔快〕 | 〈1.8s〉 | 〔一本正经〕The finish?｜Two months. ／Appreciate it then. — L1〈1.6s〉 | 是：your MOM | 最文雅的词配最粗的骂法，理由还很实际 |
| C080_main | #80 The Cup Writer（B·V6） | 键：BOOKED。冷静。100杯，每杯都要写生日快乐。v2.0 切点前移 | A hundred cups. Write "Happy Birthday" on every one! | (scribbles one) "Pick up…｜in two months." ／…Happy birthday. ／Booked. | L1 | 〔常〕 | 〈2.2s〉 | 〔反差〕(writes gorgeous calligraphy, realizes it's too nice, crosses it out) …Hold｜your number. — L1〈0.8s〉 | — | 杯上写的是取餐须知，祝福只是顺口补一句 |

### 九、职场社会类

| ID | Customer | Context (中文说明) | Customer line | Clerk line (with delivery marks) | Intensity | Pace | Target sec | Alt take line | Bleep | 笑点说明 |
|---|---|---|---|---|---|---|---|---|---|---|
| C081_main | #81 The Client（B·V3） | 键：BOOKED。嫌弃。250杯，要有质感又不要太贵 | Two-fifty cups. Premium, but not pricey. | (hands ticket) Premium:｜two months. ／Cheap: **next door.** | L2 | 〔快〕 | 〈1.6s〉 | 〔冷静〕(scans the order up and down) …Premium *is*｜the wait. ／Booked. — L1〈1.6s〉 | — | 把甲方需求拆成两个选项，便宜那个在隔壁 |
| C082_main | #82 The Contradiction（B·V3） | 键：BOOKED。真人反应。100杯，甜但不要太甜，冰但不要太冰。v2.0 改写，去掉“Case closed” | A hundred cups. Sweet but not too sweet, cold but not too cold. | (to the back) Hundred, **normal!**｜(back of house: "**HEARD!**") | L4 | 〔快〕 | 〈1.2s〉 | 〔算账〕Two contradictions.｜Ten bucks each. ／Booked. — L2〈1.8s〉 | — | 一长串矛盾需求，翻译成后厨语言就是“正常” |
| C083_main | #83 The Rush Boss（A·V3） | 键：BOOKED。一本正经（标杆）。主管派工，100杯全部急件。v2.0 爆头缩短 | A hundred cups. All **RUSH!** | Rush?｜Two months. ／**SUPER** rush— ／(stamp)〔SFX:盖章〕three. | L1 | 〔常〕 | 〈1.8s〉 | 〔冷静〕All rush?｜Then nothing's rush. ／Booked. — L1〈1.6s〉 | — | 越急越慢，盖章声刚好落在 three 上 |
| C084_main | #84 The Office Order（B·V3） | 键：BOOKED。250暗骂。帮全办公室点，大概100杯，还要对一下（“a two-fifty”评级名词第1次） | I'm ordering for the whole office, like a hundred, lemme double-check… | Don't bother.｜Whole office: ／／**two-fifty.** ／Fits the team. | L1 | 〔慢〕 | 〈2.0s〉 | 〔冷静〕(eyes their floor-length list) …Hold a meeting.｜／Then order. — L1〈1.4s〉 | — | 店员替整间公司把数字凑成250，一次暗骂整个办公室 |
| C085_main | #85 The Manager Caller（B·V7） | 键：SCRAM。中二。叫你们老板出来。选角备注：V7 性别随机，声线与美术保持中性，不往任何网络标签靠 | Get me your **manager!** | (climbs onto the stool) Manager?!｜On THIS counter— ／nobody stands **HIGHER!** ／**SCRAM!** | L5 | 〔慢〕→〔快〕 | 〈2.2s〉 | 〔一本正经〕Manager?｜In the back. (points to the end of the line) ／Get there, you'll meet them. — L1〈2.0s〉 | — | 超高柜台成了中二的王座；“我就是老板”留给第4章Boss |
| C086_main | #86 The "I'm the Customer"（B·V7） | 键：SCRAM。冷静。我是客人耶。选角备注同C085 | Excuse me, I'm the **customer!** | You haven't ordered.｜／You're not a customer. ／You're a **bystander.** | L1 | 〔常〕 | 〈1.8s〉 | 〔真人反应〕(slow nod) Mm. (keeps nodding) Mm-hm.｜／…Ordering or not? — L1〈1.8s〉 | — | 从定义上拿走他的身份，第三拍比前两拍更平 |
| C087_main | #87 The Nitpicker（B·V7） | 键：ZIP IT。一本正经。翡翠柠檬里根本没有翡翠（“老婆饼”换成 buffalo wings） | There's no actual jade in the Jade Lemon. | Correct.｜Buffalo wings have no buffalo. ／Ordering? | L1 | 〔常〕 | 〈1.6s〉 | 〔冷静〕Jewelry store?｜Down the street. ／Next. — L1〈1.4s〉 | — | 用美国人都熟悉的反例，一句话结案 |
| C088_main | #88 The Complainer（B·V7） | 键：SCRAM。250暗骂。要投诉店员 | I want to file a **complaint!** | Sure. (hands ticket)｜Complaints wait in line too. ／You're number **two-fifty.** | L1 | 〔常〕 | 〈2.0s〉 | 〔一本正经〕Complaint form.｜／Results in two months. — L1〈1.4s〉 | — | 号码牌上的号码本身就是评语 |
| C089_main | #89 The Name-Dropper（B·V7） | 键：ZIP IT。冷静。我认识你们老板喔 | I know the owner, you know. | So do I.｜They said **zip it.** | L1 | 〔快〕 | 〈1.0s〉 | 〔反差〕(snaps to attention) Friend of the owner!｜／(squints) …Nope. Order. — L4⇢L1〈1.8s〉 | — | 用老板的名义叫他闭嘴，台词里的 zip it 和按键名一致 |
| C090_main | #90 The "Just a Question"（A·V7） | 键：SCRAM。明骂（“Don't you X me!”式，不用 your MOM）。插队，只是想问一下 | I just wanna **ASK** real quick— | **ASK?!**｜Don't you **ASK** me! ／Asking waits in line too! | L5 | 〔快〕 | 〈1.6s〉 | 〔真人反应〕(finger traces the line out the door, down the block, out of sight) …Ask｜down there. — L1〈0.8s〉 | — | 原生英语的训人句型，连“问一下”都得排队 |

### 十、奇葩要求类

| ID | Customer | Context (中文说明) | Customer line | Clerk line (with delivery marks) | Intensity | Pace | Target sec | Alt take line | Bleep | 笑点说明 |
|---|---|---|---|---|---|---|---|---|---|---|
| C091_main | #91 The Restroom Ask（B·V8） | 键：SCRAM。250暗骂。可以借厕所吗（“a two-fifty”评级名词第2次） | Can I use your restroom? | Restroom?｜Two-fifty-cup club only. ／／…Eh. ／Close enough. | L1 | 〔常〕 | 〈1.8s〉 | 〔冷静〕Sure.｜／Return it in two months. — L1〈1.4s〉 | — | 他没点250杯，但店员看了一眼，觉得他本人就够格 |
| C092_main | #92 The Charger Ask（B·V8） | 键：SCRAM。真人反应。可以帮我手机充电吗。v2.0 爆头缩到“Same.” | Can I charge my phone here? | (melts onto counter) Same.｜／One percent. ／You gonna charge **me?** | L1 | 〔慢〕 | 〈1.6s〉 | 〔一本正经〕Sure.｜Outlet's outside. ／Third lamppost. — L1〈1.6s〉 | — | 店员瘫在柜台上，比顾客更像没电 |
| C093_main | #93 The Wi-Fi Ask（A·V8） | 键：SCRAM。一本正经（标杆）。有Wi-Fi吗 | Got Wi-Fi? | Yep.｜Network: **NEXT.** ／Password: **SCRAM.** | L1 | 〔常〕 | 〈1.6s〉 | 〔250暗骂〕Yep.｜Password: two-five-oh, two-five-oh. ／…You'll remember it. — L1〈2.4s〉 | — | 两句招牌台词塞进路由器贴纸格式，非常适合截图 |
| C094_main | #94 The Sitter（A·V8） | 键：ZIP IT。明骂。想要椅子，关键词改为名词 CHAIR 当动词用（SIT 进软禁用表） | Can I get a **CHAIR?** | **CHAIR** [哔:your MOM]!｜Two months standing— ／that's the **FLAVOR!** | L5 | 〔快〕 | 〈1.8s〉 | 〔冷静〕Sure.｜Sit outside. ／Two months. — L1〈1.2s〉 | 是：your MOM | 名词硬当动词骂，更荒谬；站着等被当成配方的一部分 |
| C095_main | #95 The Heat Complainer（B·V7） | 键：ZIP IT。中二。冷气可以开大一点吗 | Can you crank the AC? | (eyes closed, arms wide) A calm mind…｜is a **COOL** mind! ／The REAL ice… ／is in the **CUP!** | L5 | 〔慢〕→〔快〕 | 〈2.4s〉 | 〔算账〕Ten bucks a degree.｜It's seventy-eight in here. ／Sixty-eight? ／That's a hundred. — L2〈2.4s〉 | — | 用武道修行的口吻拒绝开冷气 |
| C096_main | #96 The Shaker（B·V6） | 键：BOOKED。真人反应。251杯，可以帮我摇匀吗 | Two-fifty-one cups. Can you shake 'em? | (picks up a cup, whole body shakes with it) …Happy?｜／Booked. | L1 | 〔常〕 | 〈1.2s〉 | 〔中二〕(raises the shaker high) No shaking!｜The golden ratio— ／is **BORN BALANCED!** — L5〈2.2s〉 | — | 摇杯变成全身摇摆，摇完一脸冷 |
| C097_main | #97 The Dog Owner（B·V8） | 键：SCRAM。冷静。狗狗可以喝吗 | Can my dog have some? | (looks at the dog, looks at them) Dog｜can stay. ／You can **go.** | L1 | 〔慢〕 | 〈1.6s〉 | 〔一本正经〕Sure.｜Dogs wait two months too. ／It's more patient than you. — L1〈2.2s〉 | — | 两次视线移动之后，宣布狗的待遇比主人好 |
| C098_main | #98 The Name Writer（B·V6） | 键：BOOKED。250暗骂。100杯，每杯写我的名字（“out of a thousand”层） | A hundred cups! Put my name on every one! | (writes) …Done.｜"Two-fifty." ／／Out of a thousand. ／Booked. | L1 | 〔慢〕 | 〈2.0s〉 | 〔嫌弃〕Name?｜／You're a number. — L2〈1.0s〉 | — | 他点的是100杯，杯上写的“名字”却是一个不及格的分数 |
| C099_main | #99 The Smile Request（B·V6） | 键：BOOKED。算账。笑一下我就点100杯。选角备注：顾客声线与美术保持中性，不能演成骚扰 | Smile and I'll order a hundred! | (stiff smile, three full seconds) …Done.｜Three hundred bucks. ／Booked. | L2 | 〔常〕 | 〈1.6s〉 | 〔真人反应〕(lip twitches three times, gives up)｜…Can't. ／Next. — L1〈1.0s〉 | — | 微笑按秒计费，店员直接开账单 |
| C100_main | #100 The Kind One（B·V8） | 键：SCRAM。反差。请问你今天心情好吗（一秒内恢复凶，符合“没有特别温柔”的红线） | Um… how's your day going? | (freezes 0.3 s, lip wobbles) …Was great.｜⤴ Then you asked. ／**SCRAM!** | 破功L1⤴L3 | 〔慢〕→〔快〕 | 〈1.8s〉 | 〔中二〕(gazes upward) My mood…?｜／Like the ice— **FULL.** ／And **COLD!** ／SCRAM! — L5〈2.4s〉 | — | 被关心的那一下差点破防，一秒内恢复凶 |

---

## Day 1 opening routine (in game: `SYSTEM_EN.opening`, docs/first-minute-spec.md section 3)

- This is the text the game plays, identical to `src/content.en.js`; beat numbers follow spec 3.3–3.7.
- **Game cut point `|`** is not the `｜` of this script: before `|` is the setup, after it the punch; each half is its own clip and the program inserts the silence (200 ms by default). Kokoro renders the setup at `speed 1.10` and the punch at `0.90` (`tools/voice/export-lines.mjs`). For a studio session, record the halves separately and leave a 40 ms tail on the setup.
- On screen the number stays "250" / "15"; it is always read "two-fifty" / "fifteen" (rewritten for TTS by `audio.ttsText`). OP07 is the one place the full quarter-wit slip is spoken (the opening is the signature routine, voice-bible 5.4).

| ID | Beat | Speaker | Line | Delivery |
|---|---|---|---|---|
| OP01 | A4 | Clerk | How many cups? | L3, looking down |
| OP02 | B3 | Customer 1 (hesitator) | Ummm… | eyes drifting |
| OP03 | B6–B8 | Clerk | Still thinking? **\|** SCRAM! | slow squint → 200 ms silence → L4 punch |
| OP04 | C3 | Customer 2 (15 cups) | 15 cups! | chin up, proud |
| OP05 | C6–C9 | Clerk | 15 cups? **\|** Too small. SCRAM! | glance at the sign → sigh 450 ms + silence 180 ms → punch |
| OP06 | D4 | Customer 3 (250 cups) | 250 cups! | hero entrance, stress "250" |
| OP07 | D8 | Clerk | Okay. 250. A quarter-wit— (cough) a quarter… of a thousand. Of what? | suddenly calm, professional, L1 |
| OP08 | D9 | Customer 3 | The signature Jade Lemon! | proud |
| OP09 | D10 | Clerk | Want me to adjust the sugar or ice? | dangerous smile, trick question |
| OP10 | D11 | Customer 3 | Yeah, adjust it! Less sugar, less ice! | entitled |
| OP11 | E4 | Clerk | ADJUST your MOM! | after 220 ms of total silence, L5 (mega: echo, 0.94 speed) |
| OP12 | E6 | Clerk | The golden ratio is PERFECT! | anime announcer, points at the sign |
| OP13 | E7 | Clerk | Everything's made fresh to order. | instantly back to service voice, L1 |
| OP14 | E8 | Clerk | 250 cups, | L1, then 250 ms silence |
| OP15 | E10 | Clerk | pick up in two months. | L1, clock ticks |
| OP16 | E11 | Clerk | Here's your pickup number. | sincerely helpful |
| OP17 | F1 | Clerk | NEXT! | L3 |

Wrong-key quips and timeouts (clerk, ≤ 2.0 s; customers are "they"):

| ID | When | Line |
|---|---|---|
| OPW01 | W1 Zip it | Zip it? They haven't said a word. |
| OPW02 | W1 Booked | Booked? They never said how many. |
| OPW03 | W2 Zip it | They said 15 cups. That's not noise. |
| OPW04 | W2 Booked | (picks up the ticket, puts it back) …15 cups? Too small. |
| OPW05 | W3 Scram (brake: only the first 150 ms play) | SCRAM— |
| OPW06 | after the W3 Scram brake | …Wait. How many cups? |
| OPW07 | W3 Zip it (brake) | ZIP— |
| OPW08 | after the W3 Zip it brake | …250 cups? That gets booked. |
| OPW09 | W4 Scram | Order's booked. Now they need to zip it. |
| OPW10 | W4 Booked | Already booked! Now they're making demands— |
| OPW11 | second wrong key on the same beat | Fine. I'll do it myself. |
| OPT01 | W1 timeout (service voice) | Hiii~ Take all the time you need~ |
| OPT02 | W2 timeout (service voice) | 15 cups~? Coming right up~ |
| OPT03 | W3 timeout (service voice) | 250 cups~ Thank you so much~ |
| OPT04 | W4 timeout (service voice) | Of course~ Less sugar, less ice~ I'll adjust it for you~ |
| OPT05 | after the first timeout (flat) | …That wasn't me. |
| OPT06 | after the second timeout (flat) | …That was work-mode me. |
| OPT07 | after the third timeout (flat) | …That one doesn't count. |
| OPT08 | after the fourth timeout (flat) | …You heard nothing. |

Day 1 free-play pool, game cut points (R10; reply / alt; a line without `|` plays whole as the punch):

| # | Main | Alt |
|---|---|---|
| 1 | (stares for three seconds, deep breath) Still thinking? **\|** SCRAM! | (checks watch) Your one second's up. **\|** Out. |
| 5 | (taps the register twice) Both. A hundred each. **\|** Two months. You're welcome. | Thinking's ten bucks a second. **\|** You're at fifty. |
| 6 | (snatches the phone) Hello? … Uh-huh. Your friend passes. (hangs up) **\|** Scram. | Your friend can get in line. **\|** You? Out. |
| 7 | Nope. Your turn's over. **\|** Next. | Huh? Thirty minutes in line… **\|** for the vibes? |
| 8 | Generous. **\|** Be generous… from the back. | Sure. Next one's up. You go back. **\|** Keep going. Keep going. |
| 11 | Sure. Your options: golden ratio. **\|** …Great choice. | (rips up the sugar chart) …Chart's gone. **\|** No more picking. |
| 12 | Less ice? The ice showed up to work. **\|** You want me to do layoffs? | LESS your MOM! Full ice tastes better! |
| 13 | (hand over face) Ice… is the SOUL. You want me to… ERASE it?! **\|** NEVER! | Hold the ice? **\|** Hold your spot. In the back. |
| 14 | Light ice? (turns, yells to the back) **\|** FULL ICE! Customer's OVERHEATING! | (nods) Light ice. Heard. **\|** Regular ice. |
| 15 | Life's bitter enough. **\|** Full sugar. You're welcome. | (eyes soften) …Rough week, huh? (instantly mean) **\|** FULL SUGAR! NEXT! |
| 16 | No sugar? That's twenty extra. (customer blinks) **\|** …Sugar-removal fee. | (clutches chest, staggers back) You've wounded… **\|** the GOLDEN RATIO… FULL SUGAR! |
| 18 | Sore throat? Doctor's orders: **\|** zip it. | (cups an ear) …Huh? Can't hear you. **\|** Regular ice. |
| 41 | One cup? You stood in line for ONE? **\|** Scram. | One cup? Two months. Two-fifty? Also two months. **\|** Your call. |
| 42 | Three cups… (turns, looks at the line) …They're writing a one-star review. **\|** About you. | Three cups. Two months. Twenty days a cup. **\|** Worth it? |
| 43 | (doesn't even look) Too small. **\|** SCRAM! | (doesn't look) Fifteen. **\|** Next. |
| 44 | Twenty-five? You're missing a zero. **\|** Go find it. | (lip twitches) …Twenty-five. **\|** One zero away from your real number. |
| 45 | (doesn't look) Fifty. Failed. **\|** Next. | Fifty… (sighs, audible) So close. **\|** Bye. |
| 46 | A hundred… (ticks a box in a tiny notebook) First passing grade today. **\|** Booked. | (almost smiles) …Ahem. It's fine. **\|** Booked. |
| 47 | (suddenly calm, professional) Okay. Two-fifty. A quarter-wit— (cough) a quarter… of a thousand. **\|** Of what? | (eyes well up) Finally… (instantly cold) **\|** Two-fifty of WHAT? Spit it out! |
| 49 | Two-fifty-one? (crosses one out) **\|** Two-fifty. Booked. | Thought one extra cup would save you? **\|** …Two-fifty. Booked. |
| 50 | (blushes, one sec) Your crush can wait. **\|** Two months. | Confessions? Different shop. **\|** Booked. |

---
## Trailer & audition top 12

| # | ID | Line (marked) | 中文意思 | 为什么选 |
|---|---|---|---|---|
| 1 | SIG06 | (slams the counter) **ADJUST** [哔:your MOM]!｜The **golden ratio** is PERFECT! ⇢ …Here's your pickup number. | 调你妈！黄金比例最好喝！⇢……这是你的取餐号码牌。 | 核心三拍（正经→爆骂→正经）一句全包 |
| 2 | C003 | Today's special:｜you, leaving. ／Runner-up: you, leaving **faster.** | 今日特餐：你，离开。第二名：你，更快地离开。 | 完美的 deadpan 递进 |
| 3 | C060 | (phone rings) …／／I can **see** you.｜(hangs up) ／Scram. | （电话响）……我看得到你。（挂断）滚。 | 沉默剪辑，适合短视频 |
| 4 | C049 | Two-fifty-one?｜(crosses one out) ／／**Two-fifty.** ／Booked. | 251？（划掉一杯）……250。收。 | 用画面讲250梗 |
| 5 | C012 | Less ice?｜The ice showed up to **work.** ／You want me to do **layoffs?** | 少冰？冰块是来上班的，你要我裁员？ | 地道、新鲜、可引用 |
| 6 | C056 / SIG08 | (flips the ledger) Two-fifty… ／found it. ／(slams it shut)｜**We start tomorrow.** | （翻本子）250杯……找到了。（啪地合上）明天开始做。 | 全作最大的反转 |
| 7 | C093 | Yep.｜Network: **NEXT.** ／Password: **SCRAM.** | 有。网络名称：下一位。密码：滚。 | 适合截图 |
| 8 | C040 | Free?｜The only thing free in this world… ／is my **EYE ROLL!** | 免费？这世上唯一免费的……是我的白眼！ | 中二的真诚感 |
| 9 | C024 | You **get** it!｜You actually **GET** it! ⇢ …Two months. | 你懂！你真的懂！⇢……两个月后来拿。 | 破功一秒再冷回去 |
| 10 | C016 | No sugar?｜That's **twenty** extra. ／／…Sugar-removal fee. | 无糖？要加二十块。……拆糖费。 | 算账风格两拍完成 |
| 11 | C034 | **PREVIEW** [哔:your MOM]!｜The premiere's in **two months!** | 试你妈！首映在两个月后！ | 全稿最好的 your-MOM 落点 |
| 12 | SSK07 | (third strike in a row) A turkey. ／…We don't serve turkey. **NEXT!** | （连续第3次全倒）三连全倒（保龄球术语叫“火鸡”）。……我们不卖火鸡。下一位！ | 美国本土的保龄球梗 |

备选：C087（buffalo wings）、C022（SERIAL NUMBER）、SSR03（“Tasted like customer service”）、SPU06（退休那天）。B5L10 是剧透，不进预告片。

---

## 统计（按本表逐行实数）

### 强度分布（主台词100句，按句中最高强度计）

| 最高强度 | 句数 | 占比 |
|---|---|---|
| L1 | 46 | 46% |
| L2 | 17 | 17% |
| L3 | 9 | 9% |
| L4 | 8 | 8% |
| L5 | 20 | 20% |
| **合计** | **100** | 100% |

含强度变化的主台词共18句：逐渐升降（→）13句；⇢ 瞬间切回正经 2句（C024、C066）；破功⤴L3 3句（C050、C075、C100）。按“结尾强度”算，L1–L2 收尾的句子中，主台词与变体合计，赶人类结尾词 SCRAM 占 5/11（约45%），其余为 Out ×2、Bye ×2、Shoo、go。

### "your MOM" 句数

| 范围 | 句数 | 明细 |
|---|---|---|
| 主台词 | 7 | C009 CHANGE、C017 SWITCH、C027 HALF、C034 PREVIEW、C062 SCAN、C079 APPRECIATE、C094 CHAIR |
| 变体（Alt take） | 2 | C012 LESS、C021 ADD |
| **本表合计** | **9** | 另有表外的 SIG06 ADJUST（招牌流程专用） |

明骂类其他形式（不含 your MOM）：C051 复读式、C067 “Split my ASS”、C090 “Don't you ASK me!”。主台词中 your-MOM 与其他形式之比为 7 : 3。

### 含消音句数

| 范围 | 句数 | 明细 |
|---|---|---|
| 主台词 | 8 | 7句 your MOM ＋ C067（ASS） |
| 变体 | 2 | C012、C021 |
| **本表合计** | **10** | |
