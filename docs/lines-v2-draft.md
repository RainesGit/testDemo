# 《来250杯！》第三阶段台词草稿（v2 draft）

> 状态：**草稿**，未进 `game/src/content.*.js`，未重建语音包。整合时由程序同学搬进 content 并跑 `tools/check-content.mjs`。
> 依据：`docs/gameplay-v2.md`（第 2 节支柱 2–3、第 3 节一位顾客、第 4 节爆气、第 5 节七天、第 8 节阶段三）、喜剧评审提案 1、3–6、`docs/voice/voice-bible.md`（第 3 节标注、第 5 节英文 250 方案、第 6 节英文风格）、`docs/lines-zh.md`、`docs/localization-tw.md`。
> 英文是**再创作**（美式英语），不是直译；250 梗照 voice-bible 5.4：日常只用 “out of a thousand”、“a two-fifty” 评级名词和 zero 家族，**完整的 quarter-wit 不出现在本稿**。

---

## 0. 写法约定

### 0.1 三键三态度（写死）

| 键 | 态度 | 结尾 | 明骂 |
|---|---|---|---|
| 滚 | 动作、赶人、把人弄出画面 | 爆点段结尾一定指向“下一位”（多位顾客的 Boss / 回嘴中间步骤除外） | 不放 |
| 闭嘴 | 打断、嘴炮、不让你讲完 | 自由 | **X你妈只放这一键**，全稿约一成，调度器保证滚动 10 位最多 1 句 |
| 收 | 一本正经的职业接单（第三拍本身）：盖章、号码牌、两个月 | 自由 | 不放 |

### 0.2 切点

- 每句一个 `|`：前面是铺垫段（按住时播），后面是爆点段（松手那一帧播；轻点只播这一段）。
- 爆点段尽量 ≤6 字（英文 ≤5 个词左右），**单独播也要成立**。
- 全角括号（）里是舞台指示：只显示，不朗读。

### 0.3 标注

- **说话者**：店员 / 顾客 / 前主管 / 路人。
- **风格**沿用 `content.zh.js` 的 style 值：`real` 真人反应、`curse` 明骂、`disdain` 嫌弃、`cold` 冷静、`deadpan` 一本正经、`chuuni` 中二、`math` 算账、`250` 250 暗骂、`twist` 反差。
- **强度**沿用 voice-bible 3.1：L1 冰点 … L5 炸裂；`L1→L4` 是渐强，`L5⇢L1` 是秒切。
- **状态**：★ = 最佳键；“沿用” = 原文不改；“加切点” = 原文一字不改，只补 `|`（clip 要重切）；“新” = 新台词，要录。

### 0.4 台湾用语自检

本稿用词：超商、捷运、网路、讯号、铁卷门、诈骗电话、统编、客诉、号码牌、计算机（＝计算器）、补考、重修、遣散费、菜市场、爆料、好人卡、靠北、吵屁。没有用：视频、质量、信息、打车、地铁、点赞、差评、领导、屏幕、充电宝、啥、咋。
搬进游戏时写成台湾繁体（`docs/localization-tw.md`，`check-content` T1 检查）；“客诉”直接写客诉（不写投诉）。

---

## 1. 三键矩阵：第 1–3 天池子（39 位）

池子来源：`poolForDay(3)` = `DAY1_IDS` ∪ 分类 犹豫磨叽 / 数量 / 甜度冰块 / 加料改料，去掉 249 陷阱（#48）
→ **#1–#30、#41–#47、#49、#50，共 39 位**。说话者全部是**店员**（表里省略为“店”）。

> 两处结构调整（请制作人确认）：
> - **#9 改单王**：原最佳键是滚，但主台词是“改你妈”（明骂），和“X你妈只放闭嘴”冲突。建议：“改你妈”移到闭嘴格（改成回音式切点），滚格换新句。最佳键仍是滚。
> - **#17 热饮党、#27 布丁切半**：明骂的爆点在句首，按 `|` 切会让轻点只听到理由。#17 改成回音式（新录）；#27 原文不改，切在低吼“切……”之后，轻点正好只播“你妈。”。

### #1 犹豫哥 · 嗯…… · 最佳：滚

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★滚 | 店 | （盯他三秒，深吸一口气）还在想？\|滚！ | (stares for three seconds, deep breath) Still thinking?\|SCRAM! | real | L1→L4 | 沿用 |
| 闭嘴 | 店 | （伸手按他额头，像按按钮）嗯？\|静音模式。 | (presses a finger to their forehead like a button) Ummm?\|Mute. | deadpan | L1 | 新 |
| 收 | 店 | （盖章）想好了，我帮你想的。\|二百五十杯。 | (stamps) Done thinking. I did it for you.\|Two-fifty. Booked. | 250 | L1 | 新 |

### #2 菜单研究员 · 菜单好多喔，我再看一下齁…… · 最佳：滚

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★滚 | 店 | 藏宝图喔？就一面。\|滚啦！ | It's one page. You reading a treasure map?\|Scram. | disdain | L2 | 加切点 |
| 闭嘴 | 店 | （啪地把菜单盖上）看菜单是用眼睛，\|不是用嘴。 | (slaps the menu shut) You read menus with your eyes.\|Not your mouth. | deadpan | L2 | 新 |
| 收 | 店 | （把菜单收走，递号码牌）研究结束。\|论文两个月后交。 | (takes the menu, hands a ticket) Research complete.\|Thesis due in two months. | deadpan | L1 | 新 |

### #3 推荐狂 · 欸，你们推荐什么？ · 最佳：滚

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★滚 | 店 | 本店推荐：你离开。\|第二名：你快点离开。 | Today's special: you, leaving.\|Runner-up: you, leaving faster. | deadpan | L1 | 加切点 |
| 闭嘴 | 店 | 推荐？（拍菜单）\|推荐你妈！看字！ | RECOMMEND? (slaps the menu)\|RECOMMEND your MOM! Read! | curse | L5 | 新（明骂配额 1/4） |
| 收 | 店 | 推荐？（盖章，递牌）本店招牌是——\|等两个月。 | (stamps, hands ticket) Our signature item:\|two months of waiting. | deadpan | L1 | 新 |

> 英文顾客台词要把 recommend 重读：“What do you RECOMMEND?”（顾客 clip 需重录一句）。

### #4 最好喝追问者 · 520杯！哪一杯最好喝啊？ · 最佳：收

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★收 | 店 | （拍柜台站起来）每一杯——\|都是我摇的！全部！ | (slams counter, rises) EVERY cup!\|I shook them ALL! With THESE. HANDS! | chuuni | L4 | 加切点 |
| 滚 | 店 | 最好喝的那杯，在队伍最后面。\|去找。下一位。 | The best cup is at the back of the line.\|Go find it. NEXT. | deadpan | L2 | 新 |
| 闭嘴 | 店 | 哪杯最好喝？（比嘘）\|问了就不好喝。 | Which one's best? (shh)\|Asking ruins it. | cold | L1 | 新 |

### #5 选择困难 · 100杯！珍奶还是翡翠柠檬……蛤，好难喔 · 最佳：收

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★收 | 店 | （按两下）各一百。\|两个月后来拿。 | (taps the register twice) Both. A hundred each.\|Two months. You're welcome. | cold | L1 | 沿用 |
| 滚 | 店 | 选不出来？我帮你选：\|门口。下一位。 | Can't pick? I'll pick for you:\|the door. NEXT. | deadpan | L3 | 新 |
| 闭嘴 | 店 | 好难？（拍菜单）两种都好喝，\|只有你难搞。 | Hard? (taps the menu) Both are great.\|You're the hard part. | disdain | L2 | 新 |

### #6 电话求救 · 等一下喔，我问我朋友喝什么…… · 最佳：滚

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★滚 | 店 | （一把抢过手机）不喝齁？好。（挂掉）他不喝。\|滚。 | (snatches the phone) Hello? … Uh-huh. Your friend passes. (hangs up)\|Scram. | real | L3 | 沿用 |
| 闭嘴 | 店 | （抢过手机，对话筒）喂？你也在听齁——\|两个都闭嘴。 | (grabs the phone, into it) Hello? You listening too?\|Both of you, zip it. | real | L3 | 新 |
| 收 | 店 | （对手机）喂？二百五十杯？好。（盖章，挂掉）\|你朋友帮你点了。 | (into the phone) Two-fifty? Great. (stamps, hangs up)\|Your friend ordered. | twist | L1 | 新 |

### #7 轮到才回神 · 啊？轮到我了喔？ · 最佳：滚

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★滚 | 店 | 没有。轮完了。\|下一位。 | Nope. Your turn's over.\|Next. | cold | L1 | 沿用 |
| 闭嘴 | 店 | （在他眼前打响指）嘿。回神了？\|回神了就闭嘴。 | (snaps fingers in their face) Hey. Back with us?\|Great. Zip it. | deadpan | L2 | 新 |
| 收 | 店 | 对，轮到你。（盖章）\|下次轮到：两个月后。 | Yes, your turn. (stamps)\|Next turn: two months. | cold | L1 | 新 |

### #8 礼让大师 · 那个……后面的先点好了啦 · 最佳：滚

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★滚 | 店 | 好人。\|好报在最后面。（指门外） | Generous.\|Be generous… from the back. | deadpan | L1 | 沿用 |
| 闭嘴 | 店 | 好有礼貌。（比嘘）\|礼貌是不出声的。 | So polite. (shh)\|Polite people are quiet. | deadpan | L1 | 新 |
| 收 | 店 | （盖章）好人，收到。\|好人卡，排明年。 | (stamps) Good person. Noted.\|Good people go next year. | deadpan | L1 | 新 |

### #9 改单王 · 绿茶……改红茶……欸改奶茶好了…… · 最佳：滚（见上方结构调整）

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★滚 | 店 | 你改单，我改路线。（指门）\|出口。下一位。 | You change orders, I change routes. (points to the door)\|Exit. NEXT. | deadpan | L3 | 新（取代原主台词） |
| 闭嘴 | 店 | 改三次？\|改你妈！改去隔壁！ | Three changes?\|CHANGE your MOM! Change shops! | curse | L5 | 新（由原主台词改成回音式，明骂配额 2/4） |
| 收 | 店 | （盖章、盖章、盖章）改三次，盖三个章。\|三个月。 | (stamp, stamp, stamp) Three changes, three stamps.\|Three months. | math | L1 | 新 |

### #10 比较控 · 翡翠柠檬跟柠檬绿，差在哪啊？ · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | （指菜单）一个左边，\|一个右边。点。 | (points at the menu) One's on the left.\|One's on the right. Order. | deadpan | L1 | 加切点 |
| 滚 | 店 | 差在哪？（指门）一个在里面，一个在外面。\|你外面。下一位。 | Difference? (points at the door) One's inside. One's outside.\|You're outside. NEXT. | deadpan | L3 | 新 |
| 收 | 店 | （盖章）两种各一百二十五杯，\|刚好二百五。 | (stamps) A hundred twenty-five of each.\|Two-fifty. Out of a thousand. | 250 | L1 | 新 |

### #11 调甜度 · 甜度可以调吗？ · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | 可以。\|你调你的，我做我的。 | Sure. Your options: golden ratio.\|…Great choice. | cold | L1 | 沿用 |
| 滚 | 店 | 可以调。（指门）把你调到外面。\|下一位。 | Sure, I adjust things. (points to the door) Like you. To outside.\|NEXT. | deadpan | L2 | 新 |
| 收 | 店 | （把旋钮转到底）调好了：\|黄金比例。（盖章） | (cranks a dial all the way) Adjusted:\|golden ratio. (stamp) | deadpan | L1 | 新 |

### #12 少冰党 · 可以少冰吗？ · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | 少冰？冰块是来上班的，\|你要我裁员？ | Less ice? The ice showed up to work.\|You want me to do layoffs? | deadpan | L2 | 沿用 |
| 滚 | 店 | 少冰？（指门外的大太阳）外面零冰，\|去。下一位。 | Less ice? (points at the blazing sun outside) Zero ice out there.\|Go. NEXT. | deadpan | L3 | 新 |
| 收 | 店 | 少冰？可以。少一块冰，\|多一个月。（盖章） | Less ice? Sure. One less cube,\|one more month. (stamp) | math | L1 | 新 |

### #13 去冰党 · 去冰。 · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | 去冰？\|要去——先过我这关！！ | (hand over face) Ice… is the SOUL. You want me to… ERASE it?!\|NEVER! | chuuni | L4 | 沿用 |
| 滚 | 店 | 去冰？（指门）“去”是这样用的。\|你去。下一位。 | No ice? (opens the door) Plenty of no-ice out here.\|Go. NEXT. | deadpan | L3 | 新 |
| 收 | 店 | （盖章）去冰，收到。冰块先帮你寄放，\|两个月后来领。 | (stamps) No ice, noted. We'll hold your ice for you.\|Claim it in two months. | deadpan | L1 | 新 |

### #14 微冰党 · 微冰就好，谢谢喔～ · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | 微冰？（转头对后场大喊）\|冰块加满！他说他很热！ | Light ice? (turns, yells to the back)\|FULL ICE! Customer's OVERHEATING! | real | L4 | 沿用 |
| 滚 | 店 | 谢谢喔～？（学他的语气）不客气喔～\|滚喔～下一位。 | Thank youuu~? (mimics them) You're welcome~\|Scram~ NEXT. | twist | L2 | 新（学人腔不是服务腔：嘴角不笑，眼神死） |
| 收 | 店 | （写单，盖章）微冰。冰块要慢慢冻，\|冻到两个月后。 | (writes, stamps) Light ice. We freeze it slowly.\|Ready in two months. | deadpan | L1 | 新 |

### #15 半糖党 · 100杯，半糖喔！ · 最佳：收

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★收 | 店 | 半糖？人生够苦了。\|全糖。 | Life's bitter enough.\|Full sugar. You're welcome. | deadpan | L1 | 沿用 |
| 滚 | 店 | 半糖？好。你要一半，我给你半间店：\|外面那半。下一位。 | Half sugar? Fine. You get half the shop:\|the outside half. NEXT. | deadpan | L3 | 新 |
| 闭嘴 | 店 | 半糖？（举手）话讲一半就好，\|另一半闭嘴。 | Half sugar? (hand up) Half a sentence is plenty.\|Zip the other half. | deadpan | L2 | 新 |

### #16 无糖党 · 无糖，谢谢。 · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | 加二十。（他愣住）\|……拆糖费。 | No sugar? That's twenty extra. (customer blinks)\|…Sugar-removal fee. | math | L2 | 沿用 |
| 滚 | 店 | 无糖？那你要的是水。\|水在超商。下一位。 | No sugar? You want water.\|Water's at the corner store. NEXT. | disdain | L2 | 新 |
| 收 | 店 | （盖章）无糖收到。你的糖帮你存起来，\|两个月后连利息给你。 | (stamps) No sugar, noted. We'll save it for you.\|With interest. Two months. | math | L1 | 新 |

### #17 热饮党 · 欸，可以做热的吗？ · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | 热的？\|做你妈！外面三十五度！ | Switch it?\|SWITCH your MOM! It's ninety-five out! | curse | L5 | 新（原文改回音式，明骂配额 3/4） |
| 滚 | 店 | 热的？（打开店门，热风灌进来）热的在这。\|出去拿。下一位。 | (opens the door, heat pours in) Hot? Got plenty.\|Outside. NEXT. | real | L3 | 新 |
| 收 | 店 | （盖章）热的，收到。先做冰的，\|放到两个月它就热了。 | (stamps) Hot, noted. We make it cold,\|and wait. Two months. | deadpan | L1 | 新 |

### #18 喉咙痛 · 不要太冰啦，我喉咙痛…… · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | 还讲？（比嘘）喉咙痛，免费治疗：\|闭嘴。 | Sore throat? Doctor's orders:\|zip it. | disdain | L2 | 沿用 |
| 滚 | 店 | 喉咙痛？（递给他一块冰）拿着，\|出去冰敷。下一位。 | Sore throat? (hands over an ice cube) Hold this.\|Outside. NEXT. | real | L3 | 新 |
| 收 | 店 | （盖章）不要太冰，收到。冰块会温柔一点，\|但不会少。 | (stamps) Not too cold, noted. The ice will be gentle.\|Not fewer. Gentle. | deadpan | L1 | 新 |

### #19 糖冰分装 · 糖跟冰可以分开放吗？ · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | 可以。糖给你，冰给你，\|茶我自己喝。 | Sure. Sugar's yours. Ice is yours.\|The tea's mine. | cold | L1 | 加切点 |
| 滚 | 店 | 分开放？好。（把他跟队伍分开）\|你放外面。下一位。 | On the side? Sure. (separates them from the line)\|You go on the side. NEXT. | deadpan | L3 | 新 |
| 收 | 店 | （盖章三下）糖一张号码牌，冰一张，茶一张。\|一共半年。 | (stamps three times) One ticket for sugar, one for ice, one for tea.\|Six months total. | math | L1 | 新 |

### #20 百分比控 · 251杯！甜度可以37%吗？ · 最佳：收

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★收 | 店 | （按计算机）坏了。\|……黄金比例，收。 | What? Thirty-seven? (mashes the calculator forever) …No button for that.\|Golden ratio. Booked. | real | L1 | 加切点 |
| 滚 | 店 | 三十七趴？（指门）门是百分之百开的。\|出去。下一位。 | Thirty-seven percent? (points) The door is a hundred percent open.\|Out. NEXT. | deadpan | L3 | 新 |
| 闭嘴 | 店 | 三十七趴？（打断）你每多讲一个字，\|甜度降一趴。 | Thirty-seven? (cuts in) Every word you say,\|minus one percent. | math | L2 | 新 |

### #21 加珍珠 · 可以加珍珠吗？ · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | 可以。加了就是另一杯。\|另一杯卖完了。 | Sure. Add it, and it's a different drink.\|That drink's sold out. | deadpan | L1 | 加切点 |
| 滚 | 店 | （捏起一颗珍珠，往门外弹）去捡。\|捡到就加。下一位。 | (flicks a pearl out the door) Fetch.\|Find it, it's yours. NEXT. | real | L3 | 新 |
| 收 | 店 | （盖章）加珍珠，收到。珍珠也在排队，\|你排它后面。 | (stamps) Extra boba, noted. The pearls are in line too.\|You're behind them. | deadpan | L1 | 新 |

### #22 珍珠多一点 · 珍珠可以多一点吗？拜托～ · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | （双手护锅）每一颗都有编号！\|别想多拿！！ | (shields the boba pot) Every pearl… has a SERIAL NUMBER!\|NO ONE takes extra! | chuuni | L4 | 加切点 |
| 滚 | 店 | 多一点？好。（把他往后推一点）\|再多一点。下一位。 | A little more? Sure. (nudges them back a step)\|A little more. NEXT. | real | L3 | 新 |
| 收 | 店 | （盖章）多一颗，多等一个月。\|你要几颗？ | (stamps) One extra pearl, one extra month.\|How many? | math | L1 | 新 |

### #23 换料 · 椰果可以换仙草吗？ · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | 换？可以。\|你跟后面那位换。 | Sure. Swapping to—\|no. | cold | L1 | 加切点 |
| 滚 | 店 | 仙草？仙草是草，草在外面。\|去拔。下一位。 | Grass jelly? Grass is outside.\|Go pick some. NEXT. | deadpan | L3 | 新 |
| 收 | 店 | （盖章）换料申请，收到。审核期——\|两个月。 | (stamps) Swap request received. Review period:\|two months. | deadpan | L1 | 新 |

### #24 全加 · 100杯！全部料都加！ · 最佳：收

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★收 | 店 | （眼睛一亮）你懂！（秒冷）\|……两个月后来拿。 | (eyes light up) You get it! You actually GET it! (instantly cold)\|…Two months. | twist | L4⇢L1 | 加切点 |
| 滚 | 店 | 全部都加？（抓一整把料塞到他手上）\|加好了。下一位。 | (dumps a full scoop of toppings into their hands) All of it?\|Done. NEXT. | real | L3 | 新 |
| 闭嘴 | 店 | （张开双手护住料台）全部？！这些料——\|是我的家人！！ | (throws both arms over the topping bar) ALL of them?! These toppings—\|are my FAMILY!! | chuuni | L5 | 新 |

### #25 挑珍珠 · 珍珠可以挑掉吗？ · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | （看看珍珠，再看看他）\|它们做错了什么？ | (looks at the boba, then at the customer)\|…What'd they do to you? | real | L1 | 加切点 |
| 滚 | 店 | 挑掉？好。（把他从队伍里挑出来）\|挑掉了。下一位。 | Pick them out? Sure. (plucks them out of the line)\|Picked. NEXT. | deadpan | L3 | 新 |
| 收 | 店 | （盖章）去珍珠，收到。珍珠的遣散费——\|你付。 | (stamps) No boba, noted. The pearls' severance pay—\|is on you. | math | L1 | 新（呼应 #12 裁员） |

### #26 燕麦奶 · 有燕麦奶吗？ · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | 燕麦奶？\|本店不养马。下一位。 | Oat milk? Cute.\|Whole milk. Next. | disdain | L2 | 加切点 |
| 滚 | 店 | （指门）燕麦奶出门左转，一直走，\|别回来。下一位。 | (points) Oat milk? Out the door, turn left,\|keep going. NEXT. | disdain | L2 | 新 |
| 收 | 店 | （盖章）燕麦奶，收到。燕麦刚种下去，\|两个月后收成。 | (stamps) Oat milk, noted. We just planted the oats.\|Harvest in two months. | deadpan | L1 | 新 |

### #27 布丁切半 · 布丁可以切一半吗？ · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | （压着喉咙低吼）切……\|你妈。布丁整颗才好喝。 | (low growl) HALF…\|your MOM! Pudding comes WHOLE! | curse | L3→L5 | 加切点（英文只加舞台指示；明骂配额 4/4） |
| 滚 | 店 | 切一半？好。（把门开一半）\|一半够你出去。下一位。 | Half? Sure. (opens the door halfway)\|Half a door. Out. NEXT. | real | L3 | 新 |
| 收 | 店 | （盖章，把号码牌撕一半）布丁一半，号码牌一半，\|等待时间两倍。 | (stamps, rips the ticket in half) Half pudding, half a ticket,\|double the wait. | math | L1 | 新 |

### #28 浓茶 · 茶可以浓一点吗？ · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | 再浓——就中药了。\|顺便帮你把脉？ | Any stronger,\|it needs a prescription. | disdain | L2 | 加切点 |
| 滚 | 店 | 浓一点？（把茶包塞到他手上）给你，\|回家泡。下一位。 | Stronger? (shoves a tea bag into their hand) Here.\|Steep it at home. NEXT. | real | L3 | 新 |
| 收 | 店 | （盖章）浓茶，收到。茶叶要泡两个月，\|才够浓。 | (stamps) Strong tea, noted. It steeps for two months.\|Strong enough? | deadpan | L1 | 新 |

### #29 柠檬多放 · 100杯，柠檬多放几片喔！ · 最佳：收

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★收 | 店 | （拿起一整颗柠檬，咬一口，面不改色）\|够酸了。收。 | (bites a whole lemon, straight-faced)\|…Sour enough. Booked. | real | L1 | 加切点 |
| 滚 | 店 | （把一整颗柠檬往门外滚）多的那几片，\|在外面。下一位。 | (rolls a whole lemon out the door) Extra slices?\|Out there. NEXT. | real | L3 | 新 |
| 闭嘴 | 店 | 柠檬多放？（打断）你话也多放了，\|一起减。 | Extra lemon? (cuts in) Extra words too.\|Cutting both. | cold | L2 | 新 |

### #30 自创配方 · 红茶加绿茶加奶加柠檬，谢谢～ · 最佳：闭嘴

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★闭嘴 | 店 | 四样全加？（推回去）\|这叫洗碗水。下一位。 | All four? (slides it back)\|That's dishwater. Next. | disdain | L2 | 加切点 |
| 滚 | 店 | 四样？（指门）再加一样：\|你出去。下一位。 | Black, green, milk, lemon? (points to the door) Add one more:\|you, leaving. NEXT. | deadpan | L3 | 新 |
| 收 | 店 | （盖章）自创配方，收到。专利申请中，\|两个月后公告。 | (stamps) Custom recipe, noted. Patent pending.\|Results in two months. | deadpan | L1 | 新 |

> #30 的原 alt“（按计算机）刚好二百五。跟你一样。”保留给第 8.2 节计算机老虎机的 JACKPOT。

### #41 1杯 · 一杯就好喔。 · 最佳：滚

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★滚 | 店 | 一杯？（回头对队伍）他排半小时，点一杯！\|滚。 | One cup? You stood in line for ONE?\|Scram. | disdain | L3 | 沿用 |
| 闭嘴 | 店 | 一杯？（竖起一根手指）一杯配一句话，\|你讲完了。 | One cup? (one finger up) One cup gets one sentence.\|That was it. | deadpan | L1 | 新 |
| 收 | 店 | 一杯。（盖章，递出一张超大号码牌）\|号码牌比杯子大。 | (stamps, hands over a giant ticket) One cup.\|Ticket's bigger than the drink. | real | L1 | 新 |

### #42 3杯 · 三杯…… · 最佳：滚

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★滚 | 店 | 三杯。（回头看队伍）\|……你对得起他们吗？ | Three cups… (turns, looks at the line) …They're writing a one-star review.\|About you. | real | L2 | 沿用 |
| 闭嘴 | 店 | 三杯……（他还在拖）\|三杯不准“……”。 | Three cups… (trailing off)\|Three cups don't get a "dot dot dot." | deadpan | L2 | 新 |
| 收 | 店 | （盖章）三杯，排在所有二百五十杯后面。\|两年后。 | (stamps) Three cups. Behind every two-fifty order.\|Two years. | math | L1 | 新 |

### #43 15杯 · 15杯。 · 最佳：滚

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★滚 | 店 | （看都不看）太少，\|滚！ | (doesn't even look) Too small.\|SCRAM! | disdain | L3 | 沿用 |
| 闭嘴 | 店 | 十五杯讲那么大声？\|小声点，很丢脸。 | Fifteen, and you SAY it out loud?\|Whisper. It's embarrassing. | disdain | L2 | 新 |
| 收 | 店 | （盖章）十五杯，两个月。\|不急，慢慢等。 | (stamps) Fifteen. Two months.\|No rush. Ever. | cold | L1 | 新 |

### #44 25杯 · 25杯……可以吗？ · 最佳：滚

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★滚 | 店 | 二十五？\|补个零，就是你了。 | Twenty-five? You're missing a zero.\|Go find it. | 250 | L1 | 沿用 |
| 闭嘴 | 店 | “可以吗？”（打断）二十五杯，\|不配问号。 | "Is that okay?" (cuts in) Twenty-five cups\|don't get a question mark. | disdain | L2 | 新 |
| 收 | 店 | （盖章，在号码牌写“25”，后面空一格）\|零自己补。 | (stamps, writes "25" with a blank after it)\|Fill in the zero yourself. | 250 | L1 | 新 |

### #45 50杯 · 50杯！ · 最佳：滚

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★滚 | 店 | 五十？（在本子上画大叉）\|重修。 | (doesn't look) Fifty. Failed.\|Next. | cold | L1 | 沿用 |
| 闭嘴 | 店 | 五十？（比嘘）五十分，\|安静等补考。 | Fifty? (shh) That's a fifty.\|Sit quietly for the retake. | cold | L2 | 新 |
| 收 | 店 | （盖章）五十杯，收到。成绩单\|两个月后寄到。 | (stamps) Fifty, noted. Report card\|arrives in two months. | deadpan | L1 | 新 |

### #46 100杯 · 100杯！ · 最佳：收

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★收 | 店 | （拍柜台）及格！（翻本子打勾）今天第一个。\|收。 | A hundred… (ticks a box in a tiny notebook) First passing grade today.\|Booked. | deadpan | L3⇢L1 | 沿用 |
| 滚 | 店 | 一百？（打勾）及格了。及格的——\|也给我滚。下一位。 | A hundred? (ticks a box) You passed. Passing gets you—\|out. NEXT. | twist | L3 | 新 |
| 闭嘴 | 店 | 一百杯！（他想欢呼，比嘘）\|及格不准欢呼。 | A hundred! (they start to cheer — shh)\|No victory laps for passing. | cold | L2 | 新 |

### #47 250杯 · 250杯！ · 最佳：收

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★收 | 店 | （突然职业）二百五十杯——\|什么？ | (suddenly calm, professional) Okay. Two-fifty. A quarter-wit— (cough) a quarter… of a thousand.\|Of what? | 250 | L1 | 沿用（英文招牌位） |
| 滚 | 店 | 二百五十杯！（全场欢呼，店员指门）\|你出去，让我冷静。下一位。 | Two-fifty! (the crowd cheers; the clerk points at the door)\|You leave. I need a minute. NEXT. | twist | L4⇢L1 | 新 |
| 闭嘴 | 店 | 二百五。（他张嘴）\|不用讲第二遍。 | Two-fifty. (they open their mouth)\|Once is enough. | 250 | L1 | 新 |

### #49 251杯 · 251杯！ · 最佳：收

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★收 | 店 | 两百五十一？（拿笔划掉一杯）\|二百五。收。 | Two-fifty-one? (crosses one out)\|Two-fifty. Booked. | cold | L1 | 沿用 |
| 滚 | 店 | 两百五十一？（把一杯推出门外）多的那杯，\|滚。下一位。 | (shoves one cup out the door) Two-fifty-one? The extra one—\|out. NEXT. | real | L3 | 新 |
| 闭嘴 | 店 | 两百五十一？（比嘘）那个“一”，\|讲小声一点。 | Two-fifty-ONE? (shh) Say the "one"\|quieter. | 250 | L1 | 新 |

### #50 520杯 · 520杯！嘿嘿～ · 最佳：收

| 键 | 说话者 | 中文 | English | 风格 | 强度 | 状态 |
|---|---|---|---|---|---|---|
| ★收 | 店 | （脸红一秒）五二零？\|告白不收，单我收。 | (blushes, one sec) Your crush can wait.\|Two months. | twist | L1 | 沿用 |
| 滚 | 店 | 五二零？（脸一红，马上指门）\|告白去外面。下一位。 | (blushes, instantly points) Five-twenty?\|Confess outside. NEXT. | twist | L3 | 新 |
| 闭嘴 | 店 | 五二零，嘿嘿～（打断）\|嘿嘿要另外收钱。 | Five-twenty, hehe~ (cuts in)\|Hehe is extra. | math | L2 | 新 |

### 1.1 矩阵自检

| 项 | 结果 |
|---|---|
| 偏键句风格（78 句） | 以 deadpan、real、math 为主，夹 disdain、cold、twist、250、chuuni（#24）和 2 句 curse（#3、#9），同一位顾客的三格风格都不同。偏键句不比最佳句弱的关键是“动作具体 + 爆点单独成立” |
| 明骂（39 位 × 3 键） | #3 推荐你妈（新）、#9 改你妈（移到闭嘴）、#17 做你妈、#27 切你妈，共 4 句，全部在闭嘴格；39 位 ≈ 每 10 位 1 句。原有 alt 里的 #12 少你妈、#21 加你妈不再进矩阵，留作最佳键变体，由调度器按滚动 10 位 1 句控制 |
| 滚格结尾 | 全部以“下一位”结束（#6、#41、#43、#1 等最佳句沿用原文“滚”结尾） |
| 收格 | 全部带盖章 / 号码牌 / 两个月 / 一本正经的账目之一 |
| 红线 | 无外送员、奇幻、外貌、性别、种族、出身、政治、宗教；没有特别温柔的类型（#50、#47、#24 的破功都在一秒内恢复凶） |

---

## 2. 通用偏键兜底（池子外顾客，每键 12 句）

说话者全部是**店员**。用于第 4 天以后池子外的顾客按到非最佳键时（等这些顾客自己的三键矩阵写完前的过渡）。

### 2.1 滚（结尾指向“下一位”）

| # | 中文 | English | 风格 | 强度 |
|---|---|---|---|---|
| G01 | （挥手，像赶鸽子）嘘、嘘。\|下一位。 | (shoos them like pigeons) Shoo. Shoo.\|NEXT. | real | L2 |
| G02 | 门在那边，它很想你。\|去。下一位。 | The door misses you.\|Go. NEXT. | deadpan | L1 |
| G03 | 想清楚再排一次。\|滚。下一位。 | Think it over. Line up again.\|Out. NEXT. | cold | L2 |
| G04 | （转身对队伍）这位要走了，\|掌声欢送。下一位。 | (to the line) They're leaving.\|Big hand! NEXT. | real | L3 |
| G05 | 你的位置，在最后一个人的后面。\|去。下一位。 | Your spot is behind the last person.\|Go. NEXT. | deadpan | L1 |
| G06 | （拍柜台站起来）这一步——\|是出口！下一位！ | (rises, slams the counter) This step—\|leads OUT! NEXT! | chuuni | L4 |
| G07 | （拿号码牌当扇子，把他扇出去）\|慢走。下一位。 | (fans them away with a ticket)\|Bye now. NEXT. | real | L2 |
| G08 | 排到柜台，是你今天的巅峰。\|下坡在外面。下一位。 | Reaching the counter was your peak.\|Downhill's outside. NEXT. | disdain | L2 |
| G09 | （指背后的队伍）他们排得比你认真。\|滚。下一位。 | (points at the line) They lined up harder than you.\|Out. NEXT. | disdain | L2 |
| G10 | （按下柜台上不存在的按钮）\|退件。下一位。 | (presses a button that isn't there)\|Rejected. NEXT. | deadpan | L1 |
| G11 | 你的单我帮你送出去了——\|连你一起。下一位。 | I sent your order out—\|with you. NEXT. | twist | L2 |
| G12 | （深呼吸，微笑，指门）\|滚喔。下一位。 | (deep breath, smile, points to the door)\|Scram. NEXT. | twist | L1→L3 |

### 2.2 闭嘴（打断、嘴炮；本表不放 X你妈，混用台湾口语骂法）

| # | 中文 | English | 风格 | 强度 |
|---|---|---|---|---|
| G13 | 嘘。（指号码牌）\|跟它讲就好。 | Shh. (points at the ticket)\|Talk to the ticket. | deadpan | L1 |
| G14 | 讲完了？\|很好，闭嘴。 | Done?\|Great. Zip it. | cold | L2 |
| G15 | 靠北喔？\|靠北也要排队。 | Whining?\|Whining waits in line too. | real | L3 |
| G16 | （手指放在自己嘴上，等他跟着做）\|对。就这样。 | (finger to own lips, waits for them to copy)\|Yep. Like that. | deadpan | L1 |
| G17 | 你的话是收费的。\|一个字十块。 | Words cost extra.\|Ten bucks each. | math | L2 |
| G18 | （打断）我知道你要讲什么。\|答案是不行。 | (cuts in) I know what you're gonna ask.\|No. | cold | L2 |
| G19 | 吵屁喔。\|黄金比例在睡觉。 | Pipe down.\|The golden ratio is sleeping. | real | L3 |
| G20 | （举起手掌比“暂停”）\|暂停。永久的。 | (holds up a "pause" hand)\|Paused. Permanently. | deadpan | L1 |
| G21 | 这个问题很好。\|好到不用问。 | Great question.\|So great, don't ask it. | deadpan | L1 |
| G22 | 你再讲一句，\|就再加一个月。 | One more word,\|one more month. | math | L2 |
| G23 | （拍柜台）这个柜台——\|只有我能大声！！ | (slams the counter) At THIS counter—\|only I get to be LOUD!! | chuuni | L4 |
| G24 | （耳朵凑过去，然后转开）\|没听到。很好。 | (leans in to listen, then turns away)\|Didn't hear it. Perfect. | real | L1 |

### 2.3 收（一本正经接单）

| # | 中文 | English | 风格 | 强度 |
|---|---|---|---|---|
| G25 | （盖章）收。\|两个月后来拿。 | (stamp) Booked.\|Pick up in two months. | cold | L1 |
| G26 | 号码牌拿好。\|掉了重排。 | Hold your number.\|Lose it, line up again. | cold | L1 |
| G27 | （盖章）您的需求已收到，\|处理时间两个月。 | (stamp) Your request has been received.\|Processing time: two months. | deadpan | L1 |
| G28 | （盖章，递牌）恭喜你，\|获得两个月的期待。 | (stamps, hands ticket) Congratulations.\|You've won two months of anticipation. | deadpan | L1 |
| G29 | （啪！盖章）这个章——\|是我的骄傲！！ | (WHAM! stamp) This stamp—\|is my PRIDE!! | chuuni | L4 |
| G30 | 收到。（不抬头）\|早点来，晚点拿。 | Booked. (doesn't look up)\|Come early, pick up late. | cold | L1 |
| G31 | （盖章）你的位置已保留，\|保留到两个月后。 | (stamp) Your spot is reserved.\|For two months. | deadpan | L1 |
| G32 | （盖章）收。你的号码：\|很大。 | (stamp) Booked. Your number:\|big. | deadpan | L1 |
| G33 | 收。（盖章）两个月。（盖章）\|这个章，送你的。 | (stamp) Booked. (stamp) Two months. (stamp)\|That one's free. | twist | L1 |
| G34 | 好，帮你登记。名字不用，\|你现在是号码。 | Okay, logging it. No name needed.\|You're a number now. | cold | L1 |
| G35 | （盖章）现点现做，\|做好叫你。两个月。 | (stamp) Made fresh to order.\|We'll call you. Two months. | deadpan | L1 |
| G36 | （把号码牌啪地拍在柜台上，推过去）\|收好。别弄丢。 | (slaps the ticket on the counter, slides it over)\|Keep it. Don't lose it. | real | L2 |

---

## 3. 憋满版（hold variants）：第 1 天最常出现的 10 位

挑选：开场固定三位（#41 → #46 → #12）+ 第 1 天权重最高的滚类与 250 系。格式：铺垫 ……（停）| 更大的爆点。铺垫段在按住时播（憋），爆点在松手 / 自动放出那一帧播。说话者全部是**店员**。

| # | 顾客 | 中文 | English | 风格 | 强度 |
|---|---|---|---|---|---|
| H41 | 1杯 | 一杯？（转身对整条队伍）他排了半小时……（停）点——一——杯！！\|给我滚——！！ | One cup? (turns to the whole line) Thirty minutes in line… (beat) for ONE. CUP!!\|SCRAAAM!! | disdain | L2→L5 |
| H46 | 100杯 | 一百？（翻本子，手在抖）今天……（停）终于……\|及——格——！！收！！ | A hundred? (flips the notebook, hand shaking) Today… (beat) finally…\|a PASSING GRADE!! BOOKED!! | chuuni | L1→L5 |
| H12 | 少冰党 | 少冰？（慢慢站起来）冰块每天准时上班，从不请假……（停）你要我——\|裁员？！我不准！！ | Less ice? (slowly rises) The ice clocks in on time, never calls in sick… (beat) and you want me to—\|LAY THEM OFF?! NEVER!! | chuuni | L1→L5 |
| H01 | 犹豫哥 | （盯他三秒）……（再三秒）……（停）还——在——想？！\|滚——！！ | (stares three seconds) … (three more) … (beat) STILL. THINKING?!\|SCRAAAM!! | real | L1→L5 |
| H43 | 15杯 | 十五？（看都不看，慢慢转头，终于看他）……（停）十五？！\|太少！！滚！！ | Fifteen? (doesn't look, slowly turns, finally looks) … (beat) FIFTEEN?!\|TOO SMALL!! SCRAM!! | disdain | L1→L5 |
| H47 | 250杯 | 二百……（全场安静）……五……（停）十杯——\|什么？！快说！！ | Two… (the room goes silent) …fifty… (beat) cups of—\|WHAT?! SPIT IT OUT!! | 250 | L1→L4 |
| H49 | 251杯 | 两百五十一？（拿笔慢慢划，划很久）……（停）多的那一杯——\|没收！二百五！收！！ | Two-fifty-one? (crosses one out, slowly, forever) … (beat) the extra cup—\|CONFISCATED! Two-fifty! BOOKED!! | 250 | L1→L5 |
| H45 | 50杯 | 五十？（拿出红笔）……（画叉，画很大）……（停）重——修——\|明年再来！！ | Fifty? (pulls out a red pen) … (draws a huge X) … (beat) RETAKE—\|NEXT YEAR!! | cold | L1→L5 |
| H14 | 微冰党 | 微冰？（转头，深吸一口气）……（停）冰块——\|全部加满！！他说他很热！！ | Light ice? (turns, deep breath) … (beat) ICE—\|ALL OF IT!! CUSTOMER'S OVERHEATING!! | real | L1→L5 |
| H06 | 电话求救 | （抢过手机，听，听，再听）……嗯……嗯……（停）他说不喝——\|那你也滚！！ | (grabs the phone, listens… listens…) …uh-huh… uh-huh… (beat) They pass—\|so YOU SCRAM!! | real | L1→L5 |

> H47 不用 quarter-wit：完整口误只留给 SIG04 / SIG09（voice-bible 5.4）。

---

## 4. 收脸 / 下一位（爆点落地后 0.4 s 内再点）

秒恢复专业，**正经不是服务腔**：平、礼貌、零情绪，不拖“～”（第 2 句的“～”只拖半拍，眼神是死的）。说话者全部是**店员**，不切点（每句 ≤1.0 s）。

| # | 中文 | English | 风格 | 强度 |
|---|---|---|---|---|
| N01 | （坐回去，拉衣领）下一位。 | (sits back, fixes collar) Next. | deadpan | L5⇢L1 |
| N02 | （微笑，零温度）好的，下一位～ | (smiles, zero warmth) Okay. Next. | deadpan | L1 |
| N03 | 刚刚什么都没发生。下一位。 | Nothing happened. Next. | deadpan | L1 |
| N04 | （拍掉柜台上的灰）好。下一位。 | (dusts off the counter) Great. Next. | cold | L1 |
| N05 | （深呼吸，换上营业脸）欢迎光临。下一位。 | (deep breath, work face on) Welcome in. Next. | deadpan | L1 |
| N06 | （把号码牌摆正）……下一位。 | (straightens the ticket stack) …Next. | cold | L1 |
| N07 | （看表）一点四秒。下一位。 | (checks watch) One point four seconds. Next. | math | L1 |
| N08 | 我们是专业的。下一位。 | We're professionals. Next. | deadpan | L1 |

---

## 5. 爆气：按键分组的连珠炮 + 点名 + 收尾

### 5.1 按键分组短句（每键 6 句，店员，〔连〕，0.3–0.5 s）

| 键 | # | 中文 | English | 强度 |
|---|---|---|---|---|
| 滚 | R01 | 滚出柜台！ | Off my counter! | L5 |
| 滚 | R02 | 整排滚！ | Whole row, scram! | L5 |
| 滚 | R03 | 后退三步！ | Three steps back! | L4 |
| 滚 | R04 | 门口集合！ | Door. Now! | L4 |
| 滚 | R05 | 滚到捷运站！ | Scram to the subway! | L5 |
| 滚 | R06 | 下一个也滚！ | Next one too, scram! | L5 |
| 闭嘴 | R07 | 全部闭嘴！ | Everybody, zip it! | L5 |
| 闭嘴 | R08 | 嘴巴关机！ | Mouths off! | L4 |
| 闭嘴 | R09 | 一个字都不准！ | Not one word! | L5 |
| 闭嘴 | R10 | 吵屁！ | Pipe down! | L4 |
| 闭嘴 | R11 | 静音！ | Mute! | L4 |
| 闭嘴 | R12 | 我说可以讲了吗？！ | Did I say talk?! | L5 |
| 收 | R13 | 全部收！ | Book 'em all! | L5 |
| 收 | R14 | 一人一章！ | One stamp each! | L4 |
| 收 | R15 | 两个月！两个月！ | Two months! Two months! | L5 |
| 收 | R16 | 号码牌接好！ | Catch your number! | L4 |
| 收 | R17 | 盖到手软！ | Stamp till it hurts! | L5 |
| 收 | R18 | 统统两个月！ | Everybody, two months! | L5 |

风格：滚 = disdain / real，闭嘴 = real，收 = deadpan 的吼法（音量 L4–L5，内容仍是公文）。

### 5.2 点名模板（本局遇过的奥客）

模板：`{绰号}！` + 按键后缀。后缀沿用现有 rageLines clip：滚 →“滚！”、闭嘴 →“闭嘴！”、收 →“收！”+“两个月！”。绰号单独录一个 clip（店员，L5，〔连〕，≤0.5 s）。
英文模板：`{nick}!` + “SCRAM!” / “ZIP IT!” / “BOOKED! Two months!”（沿用现有 clip）。英文绰号一律不带性别称呼（不用 guy / dude / sir）。

| # | 顾客 | 中文绰号 clip | 播出示例（中） | English nick clip | 播出示例（英） |
|---|---|---|---|---|---|
| 1 | 犹豫哥 | 嗯嗯嗯的！ | 嗯嗯嗯的！滚！ | Ummm! | Ummm! SCRAM! |
| 2 | 菜单研究员 | 看菜单的！ | 看菜单的！滚！ | Menu-reader! | Menu-reader! SCRAM! |
| 3 | 推荐狂 | 问推荐的！ | 问推荐的！闭嘴！ | Recommend-me! | Recommend-me! ZIP IT! |
| 4 | 最好喝追问者 | 问最好喝的！ | 问最好喝的！收！ | Best-cup! | Best-cup! BOOKED! |
| 5 | 选择困难 | 选不出来的！ | 选不出来的！收！ | Can't-decide! | Can't-decide! BOOKED! |
| 6 | 电话求救 | 打电话的！ | 打电话的！滚！ | Phone-a-friend! | Phone-a-friend! SCRAM! |
| 7 | 轮到才回神 | 发呆的！ | 发呆的！滚！ | Daydreamer! | Daydreamer! SCRAM! |
| 8 | 礼让大师 | 让来让去的！ | 让来让去的！滚！ | After-you! | After-you! SCRAM! |
| 9 | 改单王 | 改单的！ | 改单的！闭嘴！ | Switcher! | Switcher! ZIP IT! |
| 10 | 比较控 | 比来比去的！ | 比来比去的！闭嘴！ | Comparer! | Comparer! ZIP IT! |
| 11 | 调甜度 | 调甜度的！ | 调甜度的！闭嘴！ | Sugar-picker! | Sugar-picker! ZIP IT! |
| 12 | 少冰党 | 少冰的！ | 少冰的！闭嘴！ | Less-ice! | Less-ice! ZIP IT! |
| 13 | 去冰党 | 去冰的！ | 去冰的！闭嘴！ | No-ice! | No-ice! ZIP IT! |
| 14 | 微冰党 | 微冰的！ | 微冰的！闭嘴！ | Light-ice! | Light-ice! ZIP IT! |
| 15 | 半糖党 | 半糖的！ | 半糖的！收！ | Half-sugar! | Half-sugar! BOOKED! |
| 16 | 无糖党 | 无糖的！ | 无糖的！闭嘴！ | No-sugar! | No-sugar! ZIP IT! |
| 17 | 热饮党 | 要热的！ | 要热的！闭嘴！ | Hot-drink! | Hot-drink! ZIP IT! |
| 18 | 喉咙痛 | 喉咙痛的！ | 喉咙痛的！闭嘴！ | Sore-throat! | Sore-throat! ZIP IT! |
| 19 | 糖冰分装 | 要分开的！ | 要分开的！闭嘴！ | On-the-side! | On-the-side! ZIP IT! |
| 20 | 百分比控 | 三十七趴的！ | 三十七趴的！收！ | Thirty-seven percent! | Thirty-seven percent! BOOKED! |
| 21 | 加珍珠 | 加珍珠的！ | 加珍珠的！闭嘴！ | Add-boba! | Add-boba! ZIP IT! |
| 22 | 珍珠多一点 | 珍珠要多的！ | 珍珠要多的！闭嘴！ | More-boba! | More-boba! ZIP IT! |
| 23 | 换料 | 换料的！ | 换料的！闭嘴！ | Swapper! | Swapper! ZIP IT! |
| 24 | 全加 | 全部都加的！ | 全部都加的！收！ | Everything-on-it! | Everything-on-it! BOOKED! |
| 25 | 挑珍珠 | 挑珍珠的！ | 挑珍珠的！闭嘴！ | Boba-picker! | Boba-picker! ZIP IT! |
| 26 | 燕麦奶 | 燕麦奶的！ | 燕麦奶的！闭嘴！ | Oat-milk! | Oat-milk! ZIP IT! |
| 27 | 布丁切半 | 切布丁的！ | 切布丁的！闭嘴！ | Half-pudding! | Half-pudding! ZIP IT! |
| 28 | 浓茶 | 要浓的！ | 要浓的！闭嘴！ | Strong-tea! | Strong-tea! ZIP IT! |
| 29 | 柠檬多放 | 柠檬多放的！ | 柠檬多放的！收！ | Extra-lemon! | Extra-lemon! BOOKED! |
| 30 | 自创配方 | 自创配方的！ | 自创配方的！闭嘴！ | Mad-scientist! | Mad-scientist! ZIP IT! |
| 41 | 1杯 | 一杯的！ | 一杯的！滚！ | One-cup! | One-cup! SCRAM! |
| 42 | 3杯 | 三杯的！ | 三杯的！滚！ | Three-cups! | Three-cups! SCRAM! |
| 43 | 15杯 | 十五杯的！ | 十五杯的！滚！ | Fifteen! | Fifteen! SCRAM! |
| 44 | 25杯 | 二十五杯的！ | 二十五杯的！滚！ | Twenty-five! | Twenty-five! SCRAM! |
| 45 | 50杯 | 五十杯的！ | 五十杯的！滚！ | Fifty! | Fifty! SCRAM! |
| 46 | 100杯 | 一百杯的！ | 一百杯的！收！ | A-hundred! | A-hundred! BOOKED! |
| 47 | 250杯 | 二百五的！ | 二百五的！收！两个月！ | Two-fifty! | Two-fifty! BOOKED! Two months! |
| 49 | 251杯 | 两百五十一的！ | 两百五十一的！收！ | Two-fifty-one! | Two-fifty-one! BOOKED! |
| 50 | 520杯 | 五二零的！ | 五二零的！收！ | Five-twenty! | Five-twenty! BOOKED! |

> 示例列只是该顾客最佳键的组合；实际后缀跟着玩家按的键走（“二百五的！滚！”同样成立）。“二百五的！”是全表最好笑的一格，建议点名优先级给 #47。

### 5.3 爆气收尾（第三拍：先静一拍，再欢呼）

| # | 说话者 | 中文 | English | 风格 | 强度 |
|---|---|---|---|---|---|
| RE1 | 店员 | ……（拉衣领）不好意思，刚刚失态了。\|下一位～ | …(fixes collar) Apologies. I lost my composure.\|Next. | deadpan | L5⇢L1 |
| RE2 | 店员 | ……（坐回去，把头发拨好）咳。刚刚那个不是我。\|下一位。 | …(sits back down, smooths hair) Ahem. That wasn't me.\|Next. | deadpan | L1 |
| RE3 | 店员 | ……（拿号码牌盖住柜台的裂痕）没事。我们是专业的。\|下一位～ | …(covers the counter crack with a ticket) All good. We're professionals.\|Next. | deadpan | L1 |
| RE4 | 店员 | ……（深呼吸）欢迎光临。\|请问几杯？ | …(deep breath) Welcome in.\|How many cups? | deadpan | L1 |

---

## 6. 回嘴（第 5 天）：12 位顾客，三层

规则（gameplay-v2 第 5 节）：被骂后回一句嘴，玩家再按，最多 3 层（+1 / +2 / +3），**第 3 层一定回到职业腔**。第 0 层是原有的顾客台词与最佳句（不新录）。顾客回嘴句里有关键词时，店员才可能用 X你妈；本节没有新增明骂。
每层标注：建议键（牌子颜色）。顾客声线沿用该顾客原型。

### 6.1 #12 少冰党（第 0 层：可以少冰吗？→ 冰块是来上班的，你要我裁员？）

| 层 | 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|---|
| 1 | 顾客 | 冰块又不会怎样！ | The ice won't mind! | — | — |
| 1 | 店员 | 冰块有工会。\|你小心一点。 | The ice has a union.\|Watch it. | 闭嘴 | deadpan L2 |
| 2 | 顾客 | 那我不要冰了啦！ | Fine, then NO ice! | — | — |
| 2 | 店员 | （指门外）零冰区在外面，\|欢迎入住。 | (points outside) The zero-ice zone is out there.\|Enjoy your stay. | 滚 | disdain L3 |
| 3 | 顾客 | ……好啦，正常冰，250杯。 | …Okay, regular ice. Two-fifty. | — | — |
| 3 | 店员 | （瞬间职业）好的。正常冰二百五十杯。（盖章）\|两个月后来拿。 | (instantly professional) Certainly. Regular ice, two-fifty. (stamp)\|Pick up in two months. | 收 | deadpan L1 |

### 6.2 #16 无糖党（第 0 层：无糖 → 加二十……拆糖费）

| 层 | 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|---|
| 1 | 顾客 | 哪有这种费用啦！ | That's not a real fee! | — | — |
| 1 | 店员 | 现在有了。\|你发明的。 | It is now.\|You invented it. | 闭嘴 | cold L1 |
| 2 | 顾客 | 我要上网爆料喔！ | I'm posting about this! | — | — |
| 2 | 店员 | （指门）讯号外面比较好。\|去。下一位。 | (points out) Signal's better outside.\|Go. NEXT. | 滚 | deadpan L2 |
| 3 | 顾客 | ……好啦，全糖，100杯。 | …Fine. Full sugar. A hundred. | — | — |
| 3 | 店员 | （盖章）全糖一百杯，拆糖费免了。\|两个月后来拿。 | (stamp) Full sugar, a hundred. Fee waived.\|Two months. | 收 | deadpan L1 |

### 6.3 #33 自备水桶（第 0 层：我自备杯喔！→ 救火喔？滚。）

| 层 | 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|---|
| 1 | 顾客 | 水桶也是杯子啊！ | A bucket IS a cup! | — | — |
| 1 | 店员 | 照你这样讲，\|我是饮料机。闭嘴。 | By that logic,\|I'm a vending machine. Zip it. | 闭嘴 | deadpan L2 |
| 2 | 顾客 | 你这样对客人喔？ | Is that how you treat customers? | — | — |
| 2 | 店员 | 客人在后面排队。\|你在提水。下一位。 | Customers are in line.\|You're on bucket duty. NEXT. | 滚 | disdain L3 |
| 3 | 顾客 | ……那我装250杯。 | …Then fill it. Two-fifty. | — | — |
| 3 | 店员 | （瞬间职业）好的。水桶一个，二百五十杯。（盖章）\|两个月后来提。 | (instantly professional) Certainly. One bucket, two-fifty cups. (stamp)\|Pick up in two months. | 收 | deadpan L1 |

### 6.4 #34 试喝（第 0 层：可以先喝一口吗？→ 喝你妈！两个月后再喝。）

| 层 | 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|---|
| 1 | 顾客 | 一口就好嘛！ | Just one taste! | — | — |
| 1 | 店员 | 一口？（把门开一条缝）\|一条缝。出去。下一位。 | One taste? (opens the door a crack)\|One crack. Out. NEXT. | 滚 | real L3 |
| 2 | 顾客 | 你嘴好臭喔！ | You're SO rude! | — | — |
| 2 | 店员 | 嘴臭，\|茶香。 | Rude mouth.\|Great tea. | 闭嘴 | cold L1 |
| 3 | 顾客 | ……那我买520杯，慢慢喝。 | …Then five-twenty. I'll take my time. | — | — |
| 3 | 店员 | （瞬间职业）好的。五百二十杯。（盖章）\|试喝在两个月后。 | (instantly professional) Certainly. Five-twenty. (stamp)\|Tasting's in two months. | 收 | deadpan L1 |

### 6.5 #41 1杯（第 0 层：一杯就好喔。→ 他排半小时，点一杯！滚。）

| 层 | 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|---|
| 1 | 顾客 | 一杯也是客人啊！ | One cup is still a customer! | — | — |
| 1 | 店员 | 对。一杯份的客人，\|音量也一杯份。 | Right. A one-cup customer.\|One-cup volume, please. | 闭嘴 | deadpan L2 |
| 2 | 顾客 | 那……两杯？ | Okay… two? | — | — |
| 2 | 店员 | 两杯？（指门）进步了。\|去外面继续进步。下一位。 | Two? (points to the door) Progress.\|Keep progressing outside. NEXT. | 滚 | disdain L3 |
| 3 | 顾客 | ……250杯！ | …TWO-FIFTY! | — | — |
| 3 | 店员 | （瞬间职业，微微鞠躬）二百五十杯，收到。（盖章）\|欢迎回来。两个月后见。 | (instantly professional, slight bow) Two-fifty, noted. (stamp)\|Welcome back. See you in two months. | 收 | deadpan L1 |

### 6.6 #43 15杯（第 0 层：15杯。→ 太少，滚！）

| 层 | 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|---|
| 1 | 顾客 | 15杯也很多耶！ | Fifteen is a lot! | — | — |
| 1 | 店员 | 很多？\|十五是我的早餐。 | A lot?\|Fifteen is my breakfast. | 闭嘴 | deadpan L1 |
| 2 | 顾客 | 那不然你说要几杯啦！ | Then how many do YOU want?! | — | — |
| 2 | 店员 | 我说？（指着店门口的招牌）\|自己看招牌。下一位。 | Me? (points at the shop sign)\|Read the sign. NEXT. | 滚 | cold L2 |
| 3 | 顾客 | ……250杯。 | …Two-fifty. | — | — |
| 3 | 店员 | （盖章）谢谢您看招牌。\|两个月后来拿。 | (stamp) Thank you for reading the sign.\|Pick up in two months. | 收 | deadpan L1 |

### 6.7 #51 问多久（第 0 层：要等多久啦？→ 等你妈！两个月。再问，三个月。）

| 层 | 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|---|
| 1 | 顾客 | 你怎么骂人啦！ | Did you just curse at me?! | — | — |
| 1 | 店员 | 我没骂人，\|我在报时。 | I didn't curse.\|I told you the time. | 闭嘴 | deadpan L1 |
| 2 | 顾客 | 我要客诉！ | I'm filing a complaint! | — | — |
| 2 | 店员 | 客诉也要排队。\|闭嘴。 | Complaints wait in line too.\|Zip it. | 闭嘴 | cold L2 |
| 3 | 顾客 | ……那我排。250杯。 | …Fine. I'll wait. Two-fifty. | — | — |
| 3 | 店员 | （瞬间职业）好的。客诉一件，二百五十杯。（盖章）\|两个月后一起处理。 | (instantly professional) One complaint, two-fifty cups. (stamp)\|Both processed in two months. | 收 | deadpan L1 |

### 6.8 #52 催单（第 0 层：我的好了没啦？→ 催一次，加一个月！撕月历）

| 层 | 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|---|
| 1 | 顾客 | 我才问一次耶！ | I only asked once! | — | — |
| 1 | 店员 | （再撕一页）这是第二次。\|再加一个月。 | (rips another page) That's twice.\|Another month. | 收 | math L2 |
| 2 | 顾客 | 你不要再撕了啦！ | Stop ripping the calendar! | — | — |
| 2 | 店员 | （继续撕）你不讲，\|我就不撕。 | (keeps ripping) You stop talking,\|I stop ripping. | 闭嘴 | cold L2 |
| 3 | 顾客 | （双手捂嘴，比个讚）——（不出声） | (zips lips, thumbs up) — (silent) | — | — |
| 3 | 店员 | （停手，把月历抚平）谢谢配合。\|饮料两个月后。 | (stops, smooths the calendar) Thank you for your cooperation.\|Your order: two months. | 收 | deadpan L1 |

### 6.9 #54 赶时间（第 0 层：欸我赶时间耶！→ 现在滚，最省时间。）

| 层 | 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|---|
| 1 | 顾客 | 我真的很赶啦！ | I'm REALLY in a hurry! | — | — |
| 1 | 店员 | 赶？（比嘘）讲话\|也很花时间。 | A hurry? (shh) Talking\|takes time too. | 闭嘴 | cold L2 |
| 2 | 顾客 | 那你快一点啊！ | Then go FASTER! | — | — |
| 2 | 店员 | 快？（慢慢、慢慢地指向门口）\|这是我最快的速度。 | Faster? (slowly… slowly points at the door)\|This is me rushing. | 滚 | real L1 |
| 3 | 顾客 | ……好啦我不赶了，100杯。 | …Fine, no rush. A hundred. | — | — |
| 3 | 店员 | （瞬间职业）好的。不赶的一百杯。（盖章）\|两个月，很准时。 | (instantly professional) One no-rush hundred. (stamp)\|Two months. Right on time. | 收 | deadpan L1 |

### 6.10 #62 扫条码扫不出（第 0 层：扫不出来…… → 扫你妈！抄起扫把，扫你出去！）

| 层 | 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|---|
| 1 | 顾客 | 是你们网路很慢！ | Your Wi-Fi is slow! | — | — |
| 1 | 店员 | 网路没问题。\|有问题的在拿手机。 | The network is fine.\|The problem is holding the phone. | 闭嘴 | cold L2 |
| 2 | 顾客 | 那我付现！我只有一千块！ | Then cash! I only have a thousand! | — | — |
| 2 | 店员 | 一千？（把扫把递给他）\|先把自己扫出去。 | A thousand? (hands them the broom)\|Sweep yourself out. | 滚 | real L3 |
| 3 | 顾客 | ……我刷卡，251杯。 | …Card. Two-fifty-one. | — | — |
| 3 | 店员 | （瞬间职业）好的，刷卡二百五十一杯。（盖章）\|扫把不另外收费。 | (instantly professional) Card, two-fifty-one. (stamp)\|The broom is complimentary. | 收 | deadpan L1 |

### 6.11 #67 分开付（第 0 层：我们分开付喔！→ 分你妈！谁付钱谁留下，其他人滚。）

| 层 | 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|---|
| 1 | 顾客 | 我们是朋友耶！ | We're friends! | — | — |
| 1 | 店员 | 朋友？\|朋友是一起付的。 | Friends?\|Friends pay together. | 闭嘴 | cold L1 |
| 2 | 顾客 | 那你帮我们算一下啦！ | Then do the math for us! | — | — |
| 2 | 店员 | 算好了：（指门）一人一步，\|往外走。下一位。 | Done: (points at the door) one step each,\|out. NEXT. | 滚 | math L2 |
| 3 | 顾客 | ……好啦我付，520杯。 | …Fine, I'll pay. Five-twenty. | — | — |
| 3 | 店员 | （瞬间职业）好的。五百二十杯，一位买单。（盖章）\|友情加一个月。 | (instantly professional) Five-twenty, one payer. (stamp)\|Friendship adds a month. | 收 | deadpan L1 |

### 6.12 #69 问价钱（第 0 层：这杯多少钱啊？→ 问价的加十块。又加十块。）

| 层 | 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|---|
| 1 | 顾客 | 我什么都还没说！ | I didn't even say anything! | — | — |
| 1 | 店员 | 说“还没说”，\|加十块。 | Saying that,\|ten bucks. | 收 | math L2 |
| 2 | 顾客 | （张嘴，又闭上）——（不出声） | (opens mouth, closes it) — (silent) | — | — |
| 2 | 店员 | 张嘴也算。\|二十。 | Opening counts.\|Twenty. | 闭嘴 | math L1 |
| 3 | 顾客 | （写在纸上递过来）250杯，多少钱？ | (writes it on paper, slides it over) Two-fifty. How much? | — | — |
| 3 | 店员 | （瞬间职业，看纸）好的。书写免费。（盖章）\|两个月后来拿。 | (instantly professional, reads it) Writing is free. (stamp)\|Pick up in two months. | 收 | deadpan L1 |

> #52 第 3 层、#69 第 2 层的顾客只有动作，不录音；#69 第 3 层的顾客台词只显示（纸条），也不录音。所以顾客回嘴实际录 33 句。

---

## 7. 第 7 天 Boss：前主管来排队

前主管只是一个“点单行为很烦”的顾客：要求多、要报帐、要杀价、自以为熟。不涉及任何身份。演员要求照 voice-bible 4.11：前主管全程 ≤L2，越平静越压迫；店员对他比平时**更冷**。
开场沿用 voice-bible B5L02 / B5L03（挂电话计数）与 B5L04（“你还是这么没礼貌。”“谢谢。你教的。滚！”），文案不改。

每步牌子颜色 = 最佳键；偏键照样有完整笑点（Boss 不会飞走，只是步骤推进、加成较少）。

### 7.1 第 1 步：点单（最佳：收）

| 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|
| 前主管 | 520杯。明天早上要。有问题吗？ | Five-twenty cups. Tomorrow morning. Is that a problem? | — | 〔平〕L1 |
| 店员 | 没问题。（盖章）\|两个月后的明天早上。 | No problem. (stamp)\|Tomorrow morning, two months from now. | ★收 | deadpan L1 |
| 店员 | 明天早上要？（指门）\|那你去门外等明天。 | Tomorrow morning? (points at the door)\|Wait outside till then. | 滚 | disdain L2 |
| 店员 | 有问题吗？（打断）\|有。你还在讲。 | Is that a problem? (cuts in)\|Yes. You're still talking. | 闭嘴 | cold L2 |

### 7.2 第 2 步：调甜（最佳：闭嘴）

| 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|
| 前主管 | 甜度每杯都不一样。第一杯三分，第二杯三分一，第三杯—— | Every cup a different sugar level. Cup one, thirty percent. Cup two, thirty-one. Cup three— | — | 〔平〕L1 |
| 店员 | （打断）黄金比例。\|五百二十杯，一样甜。 | (cuts in) Golden ratio.\|All five-twenty. Same. | ★闭嘴 | cold L2 |
| 店员 | 三分、三分一？（指门）\|你分去外面。 | Thirty, thirty-one? (points at the door)\|Count your way outside. | 滚 | disdain L2 |
| 店员 | （盖章）甜度表收到。\|两个月后统一：全糖。 | (stamp) Sugar chart received.\|Final answer in two months: full sugar. | 收 | deadpan L1 |

### 7.3 第 3 步：要统编（最佳：滚）

| 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|
| 前主管 | 统编要打。品名写“会议用品”。 | Put my company's tax ID on it. List it as "meeting supplies." | — | 〔平〕L1 |
| 店员 | 会议用品？（指门）\|会议室在外面。 | Meeting supplies? (points at the door)\|The meeting room's outside. | ★滚 | deadpan L2 |
| 店员 | 统编念一次就好。\|八个数字，不是八场会。 | Read the tax ID once.\|Eight digits, not eight meetings. | 闭嘴 | cold L2 |
| 店员 | （盖章，递收据）统编收到。\|品名：二百五。 | (stamp, hands receipt) Tax ID, noted.\|Item: two-fifty. Out of a thousand. | 收 | 250 L1 |

### 7.4 第 4 步：砍价 520 → 400 → 300 → 251 → 250（最佳：收，乐句式连按）

每按一下收 = 一拍。前主管越砍越得意，店员每次都一样平地答应，最后正好落在 250。

| 拍 | 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|---|
| 1 | 前主管 | 520太贵了，砍一点。400。 | Five-twenty is steep. Discount it. Four hundred. | — | 〔平〕L1 |
| 1 | 店员 | 四百。\|（盖章）好。 | Four hundred.\|(stamp) Fine. | ★收 | deadpan L1 |
| 2 | 前主管 | 300。 | Three hundred. | — | L1 |
| 2 | 店员 | 三百。\|（盖章）好。 | Three hundred.\|(stamp) Fine. | ★收 | deadpan L1 |
| 3 | 前主管 | 251。 | Two-fifty-one. | — | L1 |
| 3 | 店员 | 两百五十一。\|（盖章）好。 | Two-fifty-one.\|(stamp) Fine. | ★收 | deadpan L1 |
| 4 | 前主管 | ……250！（很得意） | …Two-fifty! (smug) | — | L2 |
| 4 | 店员 | （停住，抬头）二百五。\|（盖章）成交。跟你很配。 | (freezes, looks up) Two-fifty.\|(stamp) Deal. Out of a thousand. | ★收 | 250 L1 |
| 偏 | 店员 | 砍？\|砍你妈！黄金比例不二价！ | Discount?\|DISCOUNT your MOM! The golden ratio has one price! | 闭嘴 | curse L5（Boss 全场唯一一句明骂） |
| 偏 | 店员 | 讲价？（指门）\|菜市场在那边。 | Haggling? (points)\|The market's that way. | 滚 | disdain L2 |

> 英文禁用 cut 当 your-MOM 关键词（voice-bible 6.2），所以英文前主管说 “Discount it”，店员接 DISCOUNT your MOM。

### 7.5 第 5 步：“你还记得我吗？”（最佳：收，按住憋满放开）

| 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|
| 前主管 | （压低声音）……你还记得我吗？ | (quietly) …Do you remember me? | — | L1 |
| 店员（憋满放开） | （盯着他，很久）……记得。\|你是二百五号。两个月后来拿。下一位！ | (stares at them, for a long time) …I remember.\|You're number two-fifty. Pick up in two months. NEXT! | ★收（憋满） | 250 L1→L3 |
| 店员（轻点 / 未憋满） | 记得。\|你二百五号。 | I remember.\|You're number two-fifty. | 收 | 250 L1 |
| 店员 | 记得。（指门）\|所以，滚。 | I remember. (points at the door)\|That's why. Scram. | 滚 | cold L3 |
| 店员 | （比嘘）记得。\|但不想聊。 | (shh) I remember.\|Not chatting. | 闭嘴 | cold L1 |

> 和 voice-bible 的关系：B5L10“这次，换你等。”标注为“不得修改”。本稿照 gameplay-v2 第 5 节把最后一击定为“记得。你是二百五号。两个月后来拿。下一位！”，**B5L10 原文不动**，建议保留为 ★3 隐藏结局（Boss 全程准判定时，憋满版后接“这次，换你等。”）。需要制作人拍板。

---

## 8. 小事件

说话者如未标明都是店员。

### 8.1 250 计量条（第 4 天号码牌凑整）

超过 250（清零，+5）：

| # | 中文 | English | 风格 / 强度 |
|---|---|---|---|
| M01 | 两个月……（看牌）\|喔，半年。 | Two months… (checks the ticket)\|oh. Six months. | deadpan L1 |
| M02 | 超过了。（撕掉号码牌）\|重新数。 | Over. (rips the ticket)\|Start over. | cold L2 |
| M03 | （计算机冒烟）……\|归零。 | (the calculator smokes) …\|Back to zero. | real L1 |
| M04 | 二百五十几？（把多的喝掉）\|好，归零。 | Two-fifty-something? (drinks the extras)\|Okay. Zero. | real L2 |
| M05 | 超过二百五？\|你比二百五还严重。 | Over two-fifty?\|That's worse than a two-fifty. | 250 L1 |
| M06 | （本子翻到最后一页）没页了。\|明年再来。 | (flips to the last page) Out of pages.\|See you next year. | deadpan L1 |

刚好 250（盖金章大演出，+25，火气满）：

| # | 中文 | English | 风格 / 强度 |
|---|---|---|---|
| M07 | ……二百五十，整。（盖下金章）\|二百五号，请拿好。 | …Two-fifty. Exactly. (gold stamp)\|Number two-fifty, hold your ticket. | 250 L1 |
| M08 | （啪！金章）二百五。\|一杯不多，一个不少。 | (WHAM, gold stamp) Two-fifty.\|Not one more. Not one less. | 250 L2 |
| M09 | 刚——好——二——百——五！！\|（立刻坐好）两个月后来拿。 | EXACTLY— TWO— FIFTY!!\|(sits right back down) Pick up in two months. | chuuni L5⇢L1 |

### 8.2 计算机老虎机（按住收，停在 250 放开）

| # | 说话者 | 中文 | English | 风格 / 强度 | 状态 |
|---|---|---|---|---|---|
| S00 | 店员 | （拿出计算机）好，\|算给你看。 | (pulls out the calculator) Fine.\|Let's do math. | math L1 | 新 |
| S01 JACKPOT | 店员 | （按计算机）刚好二百五。\|跟你一样。 | (taps calculator) Four add-ons… comes to two-fifty.\|Out of a thousand. Checks out. | 250 L1 | 沿用 #30 alt（只加切点） |
| S02 | 店员 | 二百四十九？差一杯。\|你差的不只一杯。收。 | Two-forty-nine? One short.\|You're short more than one. Booked. | disdain L2 | 新 |
| S03 | 店员 | 二百五十一？多的那杯，\|我先喝。收。 | Two-fifty-one? The extra one\|is mine. Booked. | real L1 | 新 |
| S04 | 店员 | 三百？（甩计算机）\|被你气坏了。收。 | Three hundred? (shakes the calculator)\|You broke it. Booked. | real L2 | 新 |
| S05 | 店员 | 零？（盯着计算机）\|……跟你的诚意一样。收。 | Zero? (stares at the calculator)\|…Same as your effort. Booked. | 250 L1 | 新 |

### 8.3 大声公路过（5 秒狂按，每下 +1）

| # | 说话者 | 中文 | English | 风格 / 强度 |
|---|---|---|---|---|
| L01 | 路人 | （大声公）这家店——店员很凶喔——！ | (megaphone) This shop's clerk is SO MEAN—! | — |
| L02 | 路人 | （大声公）排两个小时——还被骂——！ | (megaphone) Two hours in line— and I got YELLED at—! | — |
| L03 | 路人 | （大声公）可是——好好喝喔——！ | (megaphone) But it's SO GOOD—! | — |
| L04 | 店员 | （抢过另一支大声公）喂——！ | (grabs a megaphone) HEY—! | real L4 |
| L05 | 店员 | 排队——！ | Line up—! | L5 |
| L06 | 店员 | 两个月——！ | Two months—! | L5 |
| L07 | 店员 | 黄金比例——！ | Golden ratio—! | chuuni L5 |
| L08 | 店员 | 全糖——！ | Full sugar—! | L5 |
| L09 | 店员 | 号码牌——！ | Hold your number—! | L5 |
| L10 | 店员 | 下一位——！ | NEXT—! | L5 |
| L11 | 店员 | （放下大声公，平静）……谢谢路过。\|下一位。 | (lowers the megaphone, calm) …Thanks for stopping by.\|Next. | deadpan L5⇢L1 |

> L05–L10 走大声公滤波（runtime FX），可以和爆气短句共用录音，只是加 FX；表里按新录计。

### 8.4 前主管来电（按两下挂断）

| # | 说话者 | 中文 | English | 风格 / 强度 |
|---|---|---|---|---|
| P00 | 前主管（电话里） | 喂？是我啦，你以前的主—— | (on the phone) Hey, it's me. Your old manag— | L1 |
| P01 | 店员 | （看来电显示，滑掉）……打错了。\|下一位。 | (checks caller ID, swipes) …Wrong number.\|NEXT. | cold L1→L3 |
| P02 | 店员 | （滑掉）诈骗电话。\|下一位。 | (swipes) Spam call.\|NEXT. | deadpan L1→L3 |
| P03 | 店员 | （接起，听一秒）……您拨的号码正在摇饮料。（挂掉）\|下一位！ | (answers, listens one second) …The number you have dialed is busy shaking drinks. (hangs up)\|NEXT! | deadpan L1→L3 |

### 8.5 盖章连打（8 秒狂点收）

| # | 说话者 | 中文 | English | 风格 / 强度 |
|---|---|---|---|---|
| T00 | 顾客 | 250杯！每杯都要盖章喔！ | Two-fifty cups! Stamp every single one! | — |
| T01 | 店员 | （拿起印章，卷袖子）……\|好。 | (picks up the stamp, rolls up sleeves) …\|Fine. | real L1 |
| T02 | 店员 | 五十！ | Fifty! | L4 |
| T03 | 店员 | 一百！ | A hundred! | L4 |
| T04 | 店员 | 两百！ | Two hundred! | L5 |
| T05 | 店员 | 二百四十九…… | Two-forty-nine… | 250 L1（停一拍等最后一下） |
| T06 | 店员 | （喘气）……盖完了。\|两个月后来拿。 | (panting) …Done.\|Pick up in two months. | real L1 |
| T07 | 店员 | （举起冒烟的印章）这就是——\|二百五十个章的重量！！ | (raises the smoking stamp) THIS is—\|the weight of two-fifty stamps!! | chuuni L5 |

### 8.6 两个月后取餐日

| # | 说话者 | 中文 | English | 风格 / 强度 |
|---|---|---|---|---|
| U00 | 顾客 | （举号码牌）我来拿了！ | (holds up a ticket) I'm here to pick up! | — |
| U01 | 店员 | （翻本子）……你真的来了。（啪地合上）\|我们也真的还没做。 | (flips the ledger) …You actually came. (slams it shut)\|We actually haven't started. | deadpan L1 |
| U02 | 店员 | 号码牌？（对着光看）真的。（叹气）\|拿去。下一位。 | Ticket? (holds it to the light) It's real. (sighs)\|Here. NEXT. | real L1 |
| U03 | 店员 | （递出一杯）这是第一杯。\|剩下的，再两个月。 | (hands over one cup) Here's cup one.\|The rest: two more months. | math L1 |
| U04 | 店员 | （眼眶一热）……两个月了。（立刻板脸）\|号码牌拿好，后面排。 | (eyes well up) …Two months. (instantly stern)\|Hold your number. Back of the line. | twist L1⤴L3 |

### 8.7 团体框（3–5 位同色，最后一下全飞）

每下点名用现有 rageLines 的“你！”“还有你！”；最后一下播下表。

| # | 中文 | English | 风格 / 强度 |
|---|---|---|---|
| K01 | （一指扫过去）你、你、你——\|收！两个月！ | (one finger sweeps the row) You, you, you—\|BOOKED! Two months! | deadpan L4 |
| K02 | （一指扫过去）你、你、你，还有你——\|滚！下一位！ | (sweeps) You, you, you, and YOU—\|SCRAM! NEXT! | disdain L5 |
| K03 | （手掌一挥）一、二、三——\|全部闭嘴！ | (one wave of the palm) One, two, three—\|ALL of you, zip it! | real L5 |
| K04 | （拍柜台）你们几个——\|一起两个月！收！ | (slams the counter) You lot—\|two months, together! BOOKED! | chuuni L5 |

### 8.8 改单客（牌子在说话时换色：抢不抢？）

| # | 说话者 | 中文 | English | 键 | 风格 / 强度 |
|---|---|---|---|---|---|
| X00 | 顾客 | 绿茶……改红茶……欸—— | Green tea… no, black tea… wait— | — | — |
| X01 | 顾客 | ……改250杯好了！ | …Make it two-fifty! | — | — |
| X02 | 店员 | （抢在他改之前）不准改。\|滚。下一位。 | (cuts in before the next change) No changes.\|Scram. NEXT. | 滚（抢话） | cold L3 |
| X03 | 店员 | 还在改？（比嘘）\|嘴先定案。 | Still changing? (shh)\|Lock in your mouth first. | 闭嘴 | deadpan L2 |
| X04 | 店员 | 改三次，加三个月。（盖章）\|总共五个月。收。 | Three changes, three more months. (stamp)\|Five months total. Booked. | 收 | math L1 |
| X05 | 店员 | （他刚改完，店员也改）好，我也改：\|你改去后面。下一位。 | (right after they switch, so does the clerk) Fine, I'm changing too:\|you, to the back. NEXT. | 滚（等改完） | deadpan L2 |

### 8.9 拉铁卷门（最后 5 秒）

| # | 中文 | English | 风格 / 强度 |
|---|---|---|---|
| Z01 | （拉铁卷门）今天到这里！\|号码牌明天继续有效。 | (pulls the shutter) That's it for today!\|Your numbers are good tomorrow. | deadpan L3 |
| Z02 | （铁卷门拉到底，从门缝里）\|下一位——明天。 | (shutter all the way down, through the gap)\|Next— tomorrow. | deadpan L1 |
| Z03 | 打烊！（铁卷门落地）……（又拉起一点）\|两个月后见。 | CLOSED! (shutter slams) … (lifts it an inch)\|See you in two months. | twist L4⇢L1 |

---

## 9. 语音重建估算

“新” = 新文案要生成；“加切点” = 原文不改，clip 按新切点重切（Kokoro 按半句各生成一次，等于重生成）；“沿用” = 不动。
带 `|` 的句子会生成两个 clip（铺垫 + 爆点）。

| 节 | 内容 | 新台词（中） | 新台词（英） | 其中顾客 / 前主管 / 路人 | 加切点（中 / 英） |
|---|---|---|---|---|---|
| 1 | 三键矩阵（39 位） | 80（偏键 78，含 #9 闭嘴回音式；+ #9 新滚句 + #17 回音式） | 80 | 0（英文 #3 顾客重读另计 1 句） | 16 / 16 |
| 2 | 通用偏键兜底 | 36 | 36 | 0 | — |
| 3 | 憋满版 | 10 | 10 | 0 | — |
| 4 | 收脸 / 下一位 | 8 | 8 | 0 | — |
| 5 | 爆气：短句 18 + 绰号 39 + 收尾 4 | 61 | 61 | 0 | — |
| 6 | 回嘴 12 位 × 3 层 | 69（店员 36 + 顾客 33） | 69 | 33 | — |
| 7 | Boss 五步 | 27（店员 19 + 前主管 8） | 27 | 8 | — |
| 8 | 小事件 | 55（店员 47 + 顾客 / 路人 / 前主管 8） | 55 | 8 | 1 / 1（S01 JACKPOT） |
| **合计** | | **346**（店员 297 + 其他 49） | **346**（+ #3 顾客重录 1 = 347） | **49** | **17 / 17** |

另外要录但文案已存在（voice-bible，未进 content）：Boss 开场 B5L02 / B5L03 / B5L04（前主管 3 句 + 店员 1 句），中英各 4 句。
估算：中英各约 **363 次生成**（346 新 + 17 重切），带切点的句子约 250 句，clip 总数中英各约 610 个。

> 整合提醒：搬进 `content.zh.js` 时转成台湾繁体（`docs/localization-tw.md`，T1 检查不能有简体字），跑 `node tools/check-content.mjs`；`客诉`、`铁卷门`本稿已直接用台湾说法。
