# 《来250杯！》AI 美术出图清单（v3 横屏店面）

> 制作人（2026-10-27）：「商业品质……对标沙维码。」
> 路线：用 AI 出位图美术，替换现在程序画的 SVG。**图由制作人用 AI 工具出，程序这边负责接入**。
> 接入管线已经做好：`game/src/shop/pics.js` + `art-pics.js`。
> 本文是出图规范、提示词和文件清单。

## 0. 怎么运作（先看这段）

1. 你用 AI 工具出图，**文件名 = 下面清单里的 id**，例如 `tea-black.png`、`oke-c250-happy.png`。
2. 把文件放进仓库的 `game/art/raw/`。用 GitHub 网页上传到分支 `claude/claude-md-docs-facm46` 就行。
3. 我跑 `python3 tools/art/import-pics.py`。它会：
   - 自动去掉纯色背景、裁边、按游戏里的框缩放；
   - 转成 webp 放进 `game/art/shop/`，写好 `manifest.json`。
   - 游戏下次打开就换成新图。
4. **没给图的部分自动沿用现在的程序画**，所以可以一批一批地换，不会坏。
   - 打开链接时加 `?pics=0`，可以看换图前的样子来对比。
5. 维持程序画、不出图的：杯子（茶 × 配料 × 冰 × 糖的组合太多）、点单泡泡、锁头、文字和 UI 卡片。
   - 第二阶段再做「分层杯子贴图」和 UI 皮肤。

## 1. 工具与授权（必读）

- 选**付费方案明确允许商用**的工具，例如 Midjourney 付费方案、OpenAI 的图像生成、即梦/可灵/通义万相等。
  - 各家条款不一样，上架前请再确认一次。
  - 每张图留下生成记录（提示词 + 日期 + 工具），出问题时能证明来源。
- **不要**用任何现成游戏的截图或美术当参考图、垫图或风格参考，包括沙威玛传奇。
  - 提示词里也**不要写其他游戏或公司的名字**。
  - 「对标」指品质和手感，不是模仿它的画面（版权风险）。
- 设计规则照旧：
  - 没有外送员，没有奇幻元素。
  - 不拿外貌、性别、族群、地区、政治、宗教开玩笑。
  - 画面上不要有文字（招牌、菜单都用图案，不用字）。

## 2. 第一步：定风格（最重要，先做这步）

AI 出图最大的问题是**风格不统一**。所以先做一张「风格锚」：整间店的概念图。挑出最满意的一张，之后**每张图都拿它当风格参考**：

- Midjourney：`--sref <风格锚图片网址>`；角色再加 `--cref <角色定稿图>`。
- GPT / 即梦等：把风格锚图片一起上传，写「match the art style of the reference image exactly」。

**风格锚提示词：**

```
Mobile casual cooking game screenshot mockup, landscape 16:9. A cozy Taiwanese bubble tea shop at night, camera behind
the counter tilted down about 35 degrees: the top third is a warm-lit night street with people walking toward the shop,
the bottom two thirds is a stainless steel work table full of colorful drink-making equipment (tea tanks, pearl pot,
topping trays, cup sealer, shaker, cup racks), seen in three-quarter top-down view. Cute chunky cartoon style, rounded
shapes, clean dark-brown outlines, soft cel shading with gentle gradients, glossy highlights, warm key light from the
upper left, rich saturated warm colors, high-end polished casual game art, no text, no UI, no logo, no watermark
```

## 3. 统一规格（每一张都要）

**风格词**：每张图的提示词结尾都接这段。

```
cute chunky casual mobile game asset, rounded shapes, clean dark-brown outlines, soft cel shading with gentle gradients,
glossy highlights, warm key light from the upper left, saturated warm colors, three-quarter top-down view (camera
tilted about 35 degrees), polished high-end game art, single object, centered, whole object visible, isolated on a plain
pure white background, no shadow on the ground, no text, no letters, no numbers, no logo, no watermark
```

**排除词**（工具支持的话）：

```
text, letters, watermark, logo, signature, cropped, cut off, multiple objects, background scenery, floor, drop shadow,
photo, realistic, 3d render, blurry, noisy
```

**其他要求：**

- 背景：**纯白或单一纯色**（导入工具会自动抠掉）。工具能直接出透明 PNG 更好。
- 阴影：物件底下**不要画地面阴影**，游戏会自己加接触阴影。
- 解析度：长边至少 1024 px。比例照清单的「比例」栏，差一点没关系，工具会自动放进框里、底部对齐。
- 光：主光一律在**左上**，暖色。
- 视角：设备一律**斜上方往下看约 35°**，要看得到顶面和锅里、盒里的东西。
- 人物：**正面全身站立、看向镜头**（他们在仰望店员），头大身小（头约占身高 1/3）。

**变体**：同一个东西的不同状态（例如 `-empty`、`-busy`）要用**同一张图改**，位置、大小、角度都不能变，只改状态。

- Midjourney：用 Vary Region 局部重绘。
- 其他工具：用「局部编辑」或上传原图写「same object, same angle, only change …」。

## 4. 第一批（风格测试，先出这 12 张）

先出这批，我接进游戏、发链接给你看整体效果，满意了再出其余的。

| id | 比例 | 内容（接在风格词前面） |
|---|---|---|
| `street` | 约 4.5:1（宽） | night street of a Taiwanese city seen from inside a bubble tea shop, sidewalk in front, a lit corner convenience shop on the far left with a striped awning, old apartment buildings with balconies and picture-only signs, street lamps, warm light spilling on the sidewalk, empty of people. *（这张是场景，不用白底，要铺满）* |
| `table` | 约 3:1（宽） | empty stainless steel work table of a bubble tea shop, seen from behind the counter tilted down, the back edge raised as a wooden step, a terracotta rubber bar mat at the front, warm tiles behind. *（场景，铺满；设备不要画，游戏会放上去）* |
| `tea-black` | 2:3 | a tall stainless steel tea dispenser tank with a tap, filled with black tea (amber window) |
| `pot` | 1:1 | a big steel pot full of glossy black tapioca pearls in syrup, seen from above |
| `top-pearl` | 1:1 | a rectangular steel topping tray full of glossy black tapioca pearls |
| `sealer` | 3:4 | a compact bubble tea cup sealing machine, red body, chrome press head, cup slot |
| `rack` | 3:4 | a stack of empty clear plastic bubble tea cups in a steel cup dispenser |
| `oke-c250` | 9:21（竖） | 250杯客（见第 6 节），正面全身站立 |
| `oke-c250-happy` | 9:21 | 同一个人，开心大笑闭眼 |
| `reg-1` | 9:21 | 一般客人 1（见第 6 节），正面全身站立 |
| `clerk` | 4:5 | 店员（见第 7 节），idle 表情，腰部以上 |
| `clerk-hit` | 4:5 | 店员，爆骂表情 |

## 5. 全部清单

括号里是比例；`-xxx` 结尾的是同一张图的状态变体（第 3 节）。打勾的 P1 是第二批，其余 P2。

**工作台设备（P1）**

- `tea-black` / `tea-green` / `tea-jade`（2:3）：茶桶，窗口分别是红茶琥珀色、绿茶淡黄绿、翡翠青茶翠绿。
  - `-fast`：Lv2 升级版，加一圈金属装饰和更大的出水口。
- `pot`（1:1）：珍珠锅。
  - `pot-empty`：空锅。
  - `pot-cooking`：锅里冒蒸气、珍珠在煮。
  - `pot-rig`：Lv3 自动煮锅的机械臂，单独一张，会叠在锅上方。
- 配料盒（1:1），钢盒子装满：
  - `top-pearl`：珍珠。
  - `top-coconut`：椰果，白色小方块。
  - `top-pudding`：布丁，黄色方块。
  - `top-grass`：仙草，黑色亮晶冻块。
  - `top-taro`：芋圆，紫、橘、米三色小块。
  - `top-bean`：红豆。
  - 每种都要 `-low`（剩三分之一）和 `-empty`（空盒）。
- `ice`（1:1）：冰块桶。`ice-smart`：自动制冰出冰机（升级）。
- `syrup`（2:3）：果糖按压瓶。
- `sealer`（3:4）：封口机。
  - `sealer-busy`：压头压下、白光一闪。
  - `sealer-turbo`、`sealer-busy-turbo`：Lv2 金色版。
- `rack`（3:4）：杯架。`trash`（3:4）：垃圾桶，踩踏式。
- `milk`（2:3）：鲜奶按压机。`milk-fast`：Lv2。
- `foam`（3:4）：奶盖机，奶油色机身、出奶盖的嘴。`foam-fast`：Lv2。
- `shaker`（4:5）：摇杯机。`shaker-busy`：摇动中，加动态线。`shaker-auto`：Lv3。
- `lemon`（1:1）：一盘柠檬片。`lemon-low`、`lemon-empty`。
- `board`（4:3）：砧板 + 刀 + 半颗柠檬。`board-slicing`：刀切下去。
- `waffle`（约 1.1:1）：鸡蛋糕烤盘，铸铁、小圆格。`waffle-cooking`：冒热气。
- `snack-spot-0` 到 `snack-spot-3`（1:1）：保温台，上面放 0–3 个红条纹纸袋。`snack-bag`：单一个纸袋，玩家会拖它。
- `bag-0` 到 `bag-4`（1:1）：牛皮纸提袋，里面露出 0–4 个杯盖。
- `manifold-1` / `-2` / `-3`（很扁的横条）：Lv3 接在茶桶上方的不锈钢管线，P2。
- `shelf-3` 到 `shelf-6`（1:1）：出杯台，两层木架、有圆形杯座。
  - **杯座位置要和现在的程序画一致**（打开 `?pics=0` 截图当底图描），P2。
- `slot`（2:1）：吧台垫上的不锈钢杯座，从上往下看是一个圆托盘。

**桌面装饰（P2，只装饰、不能点）**

- `fridge`（很瘦的竖条）：玻璃门饮料冰箱，侧面。
- `lightbox`：灯箱菜单，只有饮料图片、没有字。
- `fan`：桌扇。`register`：收银机。`cash-tray`：零钱盘。`tip-jar`：小费罐。
- `tower-stand`（扁）：木头展示座。`golden-card`：裱框的金色卡片，图案是杯子 + 金色星星，没有字。
- `coin`（1:1）：金币，正面有一颗珍珠杯图案。

**街道与店面（P1）**

- `street`：见第一批。
  - 升级变体：`street-neon`（店门口多一块霓虹灯，图案是杯子）、`street-rail`（门口多排队栏杆）、`street-neon-rail`（两个都有），用 `street` 改。
- `ac`：冷气外机。`speaker`：喇叭。`ticket-machine`：取号机。三个都是升级道具，挂在窗边柱子上。
- `car-1` 到 `car-3`（21:9，侧面）：普通小汽车，不同颜色。
- `scooter-1` 到 `scooter-3`（21:9，侧面）：停着的普通机车，**没有骑士、没有外送箱**。

**人物（P1，见第 6、7 节）**

- `oke-<type>`：8 个奥客 × 4 张（正面、`-happy`、`-mad`、`-back`）。
- `reg-1` 到 `reg-12`：一般客人，每人 4 张。
- `clerk`、`clerk-hit`、`clerk-perfect`、`clerk-polite`：店员。
- `helper`：工读生，胸像，红帽子、围裙，双手在胸前做饮料。`helper-2`：帽子上加金星。

## 6. 客人设计

**4 张一组**，脸、发型、衣服完全一样：

- `<id>`：正面站立，微笑抬头看。
- `<id>-happy`：开心，拿到饮料，眯眼大笑，身体弹起来的感觉。
- `<id>-mad`：被骂走，又惊又气、嘴巴张大、手举起来。
- `<id>-back`：背面，转身走开。

**人物提示词开头：**

```
full-body chibi character standing, facing the camera and looking slightly up, head about one third of the body
height, big expressive eyes, ...（下面的人物描述）
```

**8 个奥客**（每个要一眼认得出，道具要大）：

| id | 是谁 | 描述（英文接进提示词） |
|---|---|---|
| `oke-c250` | 250杯客（主角级） | cheerful office worker in a light blue shirt and tie, holding up a very long paper order list that unrolls to the floor, beaming |
| `oke-one` | 一杯就好 | cautious young man in a plain gray hoodie holding up exactly one finger, hesitant smile |
| `oke-taste` | 试喝客 | young woman in a cozy knit sweater holding a tiny paper tasting cup, pleading puppy eyes |
| `oke-lessIce` | 少冰党 | man in a neat polo shirt pointing down firmly, very serious picky expression, holding a small ice cube icon card |
| `oke-cutIn` | 插队客 | guy in a baseball cap and windbreaker sliding in sideways, one hand raised as if "just asking", sneaky grin |
| `oke-bucket` | 自备水桶 | sporty person in a tracksuit proudly holding a big blue plastic water bucket with both hands |
| `oke-phone` | 讲电话客 | businesswoman with curly hair and round glasses, phone pressed to her ear, other hand raised to say "wait" |
| `oke-live` | 网红直播 | trendy streamer holding a phone on a selfie stick with a small ring light, waving at the phone |

**12 个一般客人**（各种日常台湾路人；衣服颜色彼此错开，不要撞色）：

1. 高中生，运动服式校服，背书包。
2. 大学生，帽 T，耳机挂脖子。
3. 上班族，衬衫，挂识别证。
4. 阿公，鸭舌帽、背心外套。
5. 阿嬷，花衬衫，提菜篮。
6. 健身的人，运动背心，提运动包。
7. 工程师，格子衬衫，背笔电包。
8. 护理师，刷手服。
9. 观光客，相机挂胸前、渔夫帽。
10. 滑板少年，宽 T、毛帽。
11. 画画的人，围裙沾颜料。
12. 穿西装外套的年轻女生，提公事包。

不要外送员、警察或宗教服装，不要夸张丑化。

## 7. 店员（主角）与工读生

店员定稿要先做一张**角色设定图**（正面、表情集），之后每张用它当角色参考。

**店员描述：**

```
bubble tea shop clerk, young adult, messy dark hair with one cowlick sticking up and side-swept bangs to the right,
half-closed smug eyes, one eyebrow raised, purple polo shirt uniform with a collar, cream apron, a small blank paper name
badge, upper body behind a counter with hands resting on it
```

| id | 表情、姿势 |
|---|---|
| `clerk` | 欠揍脸：半闭眼、挑眉、嘴角往一边勾的坏笑，双手搭在柜台上。 |
| `clerk-hit` | 爆骂：眉毛压到眼睛上、眼白变大、嘴巴张成梯形大吼，身体前倾，一只手指出去，额头青筋，背景加放射线也可以。 |
| `clerk-perfect` | 秒回专业：眼睛正常张开、嘴一字、眉平，一只手整理围裙，超冷静。 |
| `clerk-polite` | 服务脸：眼睛弯成月牙、笑得太开露出整排牙、一滴汗。 |

**三拍反差**（礼貌 → 突然爆骂 → 秒回专业）是这个游戏的核心笑点。`clerk-hit` 和 `clerk-perfect` 要差得越夸张越好。

## 8. 导入与验收

在 `game/` 目录下：

```
node tools/art/pic-ids.mjs            # 更新 art/shop/ids.json（每个 id 的框、建议像素、场景/物件）
python3 tools/art/import-pics.py      # art/raw/* → art/shop/<id>.webp + manifest.json（pip install pillow）
node tools/shot-shop.mjs --day=4      # 截图看效果；--pics=art/_test 可以先用测试资料夹
```

**导入工具的细节：**

- 去背：从图片边缘把相连的纯色背景挖掉，容差用 `--tol` 调。
- 已经是透明背景的 PNG 不会动。
- 场景（`street`、`table`）不去背，会从中间裁成游戏要的比例。

**验收：**

- 打开链接，带 `?pics=0` 和不带各看一次。
- 检查四件事：
  - 风格统一（同一盏光、同一种描边）；
  - 物件站在桌上不飘（底部对齐）；
  - 人物 4 张变体对得上；
  - 画面上没有字。
- `node --test test/*.test.mjs`、`node tools/check-shop.mjs` 都要过。

## 9. 动画说明（为什么一张图就够）

- **位图是整张的**：人物走路用整体弹跳、摇摆，开心时跳一下，被骂飞出去时旋转；设备工作时整张压一下、晃一下。这些都由程序做。
- **以后要更生动**（腿会走、手会动），可以把人物拆成头、身体、手、脚几层再出图。那是第三阶段，等第一批风格定了再说。
