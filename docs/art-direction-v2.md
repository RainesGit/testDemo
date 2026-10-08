# 《來250杯！》美術方向 v2（開發照做版）

> 2026-10-08，美術總監。依據：製作人回饋「肯定不能把反差打螢幕上呀，而且看起來還是劣質，用上你全部所能用上知識先把頁面給我搞好看」。
> 本文件**取代** `docs/first-minute-spec.md` §2（美術規範）與 §5.2 的花字外觀；§3 開場劇本的節拍、三鍵顏色規則（牌色 = 鍵色）、§4 節奏一律不變。
> 遊戲只出**繁體中文（台灣用語）與英文**，本文件所有中文字串皆為繁體。
> 參考圖（scratchpad，不進 repo）：現況截圖 `ad/before/`，目標樣稿 `ad/mock-play.png`、`ad/mock-start.png`、`ad/mock-summary.png`（原始 HTML 同名）。

---

## 0. 一句話與情緒詞

**一句話：夜市裡最亮的那間手搖飲攤——暖光壓克力招牌下站著一個欠揍的店員，門外是排到看不見的藍色人龍。**

情緒詞：**暖亮（溫暖的店內光）／欠揍（店員的表情與姿態）／俐落（介面極少、每個字都有用）**。

三條總原則：
1. **演出來，不要寫出來。** 機制名稱（反差、快嘴、倍率、爆氣、全倒、評級）不准出現在遊玩畫面上；用表情、鏡頭、聲音、道具表現。
2. **一次只有一個主角。** 任何時刻畫面上最多 1 個花字、1 行字幕、1 個飛行數字；其餘資訊退到道具裡。
3. **店內暖、店外冷。** 暖光只打在店員、牌子、櫃台上；顧客與人龍背光、帶冷色邊光。這一條就能讓畫面有景深。

---

## 1. 現況為什麼看起來劣質（截圖：`ad/before/`）

> 注意：Playwright 環境連不上 Google Fonts，截圖裡的中文是系統後備字型（文泉驛正黑）。**真實玩家在 Google 被擋或慢的網路下看到的就是這樣**，所以字型必須自架（§3）。

| # | 問題 | 證據 |
|---|---|---|
| 1 | **強制 9:16 舞台**：390×844 的手機上下各 75px 黑邊，像沒適配的移植版 | 所有 `390x844-*.png` |
| 2 | **沒有明度結構**：整面平塗橘牆 + 一大塊空的咖啡色櫃台（y 49–74% 幾乎空著），**被罵的顧客只露頭髮**、被字幕帶蓋住；前主管 Boss 幾乎看不到 | `390x844-10-open-08-B6`、`d7-bossHold` |
| 3 | **所有東西同一條黑粗線**：背景杯子、層架、燈箱、按鈕、角色線寬一樣黑，沒有空氣透視，前後打架 | 全部 |
| 4 | **字太多、同時出現**：花字 + 黑條 OS（重複字幕內容）+ 字幕 + `+58` 膠囊 + `×5 連擊` + `快嘴` 膠囊 + 牌角 `×1.5` + 「後面」+ 手勢小牌 + 氣勢/火氣字樣；第 3 天爆氣「快嘴！」「爆氣！」兩個花字疊在一起 | `d3-rage`、`voice-karaoke-lit` |
| 5 | **字體沒有層級**：全部同一款粗黑體，到處 `-webkit-text-stroke` 描邊，Bangers/Impact 數字廉價，「現 點 現 做」硬拉字距 | `01-start`、`d1-*` |
| 6 | **UI 是通用網頁零件**：半透明黑膠囊 + 1px 白邊（`#000a`、`#fff4`）、黃框黑卡、儀表板式統計格；圓角 99px/5cqw/4cqw/2cqw 混用、陰影各自為政；第 6 天結算卡**超出畫面**（按鈕被切），中/EN 膠囊壓在卡片上 | `d6-99-summary`、`d4-99-summary` |
| 7 | **角色是素材庫臉**：店員五官置中對稱、點點眼、刺蝟瀏海，縮小後認不出；顧客是橢圓 + 髮型貼片；排隊人是彩色方塊人站在櫃台前，比例亂 | `d1-*`、`d6-group` |
| 8 | **沒有光**：吊燈下沒有光池，陰影只有 `color-mix 78% 黑` 的泥巴色；爆氣與被迫營業用全螢幕 multiply 染色，把整個畫面弄髒 | `voice-rage`、`d4-rage` |
| 9 | **構圖遮擋**：店員頭蓋住燈箱菜單（「黃金比例 不能調」是梗的伏筆卻被擋）、叫號器和監視器被切邊、層架是同一個杯子重複 10 次；花字常蓋住店員的臉（笑點本身） | `10-open-38-E4`、`d1-talking` |
| 10 | **特效平均且過量**：每一題都是雙層描邊花字 + 震屏 + 白閃，粗墨速度線蓋滿全畫面；沒有東西留給高潮，「調你媽」不比「滾」大多少 | `10-open-*`、`d1-fling` |

---

## 2. 色彩、明度、光、陰影、線寬

### 2.1 色票（B 包寫進 `style.css` `:root`；A、C 只引用，不改 `:root`）

```css
:root{
  /* 夜（店外、人龍、留白） */
  --night-900:#0E1120; --night-700:#1B2040; --night-500:#2D3466; --rim-cool:#7FD4FF;
  /* 店內牆（暖光池：中心亮、邊緣暗） */
  --wall-hi:#FBE6BE; --wall:#EBC08A; --wall-lo:#A9734A; --slat-line:#C7925E;
  /* 天花板、深木 */
  --wood-dk:#3A2418; --wood-dk-hi:#55361F;
  /* 不鏽鋼櫃台檯面 */
  --steel-hi:#F2F4F7; --steel:#BCC3CE; --steel-lo:#737C8C;
  /* 櫃台正面（深紫壓克力，讓紙牌跳出來） */
  --counter-hi:#3B2F5E; --counter:#2A2142; --counter-lo:#151026;
  /* 墨線：角色用 --ink；背景道具用 --ink-bg（暖褐，不用黑） */
  --ink:#1B1311; --ink-bg:#4A2C1C;
  /* 紙（點單牌、收據、號碼牌） */
  --paper:#FFF7E6; --paper-sh:#EAD8B4; --paper-line:#CDBB98;
  /* 三鍵（R1 不變，只微調飽和）＋深色 */
  --gun:#EE4130;  --gun-deep:#B42A1E;
  --shut:#7658F2; --shut-deep:#4C34B4;
  --take:#FFC21A; --take-deep:#DE9800;
  /* 點綴 */
  --lemon:#FFD84A; --gold-hi:#FFF3B0; --mint:#3CC98E; --fury:#FF8A2A;
  /* 介面文字 */
  --text:#FFF7E6; --text-dim:rgb(255 247 230 / .62);
  /* 角色 */
  --skin:#F2C7A0; --skin-sh:#D99B78; --skin-hi:#FFE2C6;
  --hair:#241815; --hair-hi:#5B4038;
  --uniform:#3A2F63; --uniform-sh:#2A2149; --uniform-hi:#4D4183;
  --mouth:#5A1414;
}
```

- 刪除：`--wall-line`、`--wood`、`--wood-lip`、`--wood-sh`、`--wood-line`、`--cream`（改 `--paper`）、`--pink`、`--rage`、`--aura`、`--panel`、`--hz-yellow`（花字改用 `--lemon`/金漸層）。引用處逐一換掉。
- **翡翠綠只給飲料**，不是按鍵色（沿用）。
- 新增色只能從這張表取；要加新色先改本文件。

### 2.2 明度結構（由暗到亮）

| 層 | 內容 | 明度 | 規則 |
|---|---|---|---|
| 遠景 | 店外夜色、天花板 | 最暗（10–20%） | 無描邊；HUD 放在這裡，不需要底板 |
| 背景 | 後牆、層架、燈箱、叫號器、監視器 | 中亮（60–85%），中心亮邊緣暗 | `--ink-bg` 細線；彩度低 |
| 中景（主角） | 店員 | 對比最強：`--ink` 黑線 + 飽和制服/圍裙 | 只有他和牌子用純黑線 |
| 前景 | 櫃台正面、顧客、人龍 | 暗（20–40%） | 顧客整體壓暗 10%，頂部暖色邊光；人龍是冷色剪影 |
| 焦點 | 點單牌、號碼牌 | **全畫面最亮**（紙色 + 鍵色框） | 不准有比牌子更亮的大面積元素 |

### 2.3 光

- 主光：兩盞吊燈在店員頭頂偏左上，暖白。後牆用 **SVG `radialGradient`**（`--wall-hi` → `--wall` → `--wall-lo`，中心在店員頭後方 50%/34%）畫光池，不用 CSS 偽元素。
- 店員：頭髮頂部一道 `--hair-hi` 邊光（6px 弧線）；臉、脖子、制服的陰影一律在**右側與下方**（光從左上）。
- 顧客與人龍：背光。顧客頭頂一道 `#FFE6B0` 暖邊光（店內光從他前方打來）；人龍剪影用 `--night-700/500` 填色 + `--rim-cool` 邊光，手機族加一點 `#9EE3FF` 螢幕光。
- 狀態光（取代全螢幕染色 `.tint`）：
  - 被迫營業：牆光池色溫往粉調（`--wall-hi` 改 `#FFE0EA`），店員頭頂冒一滴汗，**不染整個畫面**。
  - 爆氣：畫面四周 18% 的紅色暈影（`radial-gradient(transparent 55%, rgb(238 65 48 / .45))`）+ 吊燈晃動；中心保持乾淨。

### 2.4 陰影

- 場景：**兩階賽璐璐**。每種材質只有「本色 + 陰影色 + （可選）高光色」。陰影色 = `color-mix(in oklab, 本色 72%, #3A2A5A)`（偏冷紫，跟暖光對比），高光色 = `color-mix(in oklab, 本色 70%, #FFF2C8)`。廢除舊的「78% 混黑」。
- 介面：只有兩種投影：
  - 按鈕 / 紙張：硬投影 `0 1.4cqw 0 <該元素的 -deep 色>`（金鈕用 `#B57A00`）。
  - 浮起的卡片：`0 2cqw 0 rgb(0 0 0 / .35)`。
  - 其他元素不准加陰影；不准再用 `text-shadow` 偏移墨色。
- 沿用禁令：無 SVG `<filter>`、無 `filter:`、無 `backdrop-filter`。

### 2.5 線寬（越近越粗、越背景越淡）

| 對象 | 渲染寬 | 顏色 |
|---|---|---|
| 顧客外輪廓 | 1.2cqw | `--ink` |
| 店員外輪廓 / 內線 | 1.0cqw / 0.6cqw | `--ink` |
| 點單牌框 | 0.9cqw | 鍵色（收：`--ink`） |
| 燈箱、叫號器、監視器、櫃台檯面 | 0.45cqw | `--ink-bg` |
| 後牆木條、層架杯子 | 0.3cqw | `--slat-line` / `--ink-bg` |
| 人龍剪影 | 無輪廓，只有 0.5cqw 冷邊光 | `--rim-cool` |
| 介面（按鈕、紙卡） | 0.7cqw | `--ink`；深色面板**無邊框** |

---

## 3. 字型（全部 SIL OFL 1.1，自架子集）

### 3.1 字型與用途

| 角色 | 字型 | 字重 | 用在哪 | 尺寸（cqw） |
|---|---|---|---|---|
| Logo、介面、按鈕、卡片標題、手寫感招牌 | **jf open 粉圓 Huninn**（台灣 justfont） | 400（本身就粗圓） | Logo 的「來」「杯」、開店鈕、HUD 標籤、卡片標題、壓克力字「現點現做」、事件名稱 | 標題 7–9；按鈕 7；一般 4.2 |
| 字幕、長句、收據內文 | **Noto Sans TC** | 500 / 700 / 900 | 字幕 700；字幕的爆點詞 900；收據列 500 | 字幕 5.4（長句最小 4.4）；爆點 7–8 |
| 點單牌手寫字 | **LXGW WenKai TC（霞鶩文楷 TC）** | 700 | 點單牌上的**文字**（「少冰」「嗯……」「我自備杯」）、黑板謎題 | 牌字 5.4–9 |
| 數字 | **Baloo 2** | 800 | 排隊人數、牌上杯數、+N、收據數字、Logo 的「250」、計時 | 牌上杯數 13；HUD 8；Logo 28 |
| 叫號器七段顯示 | **DSEG7 Classic** | Bold | `取餐號碼` 的 001、計算機事件 | 7 |
| 英文介面 / 英文花字 | Baloo 2 800（取代 Bangers） | — | `lang=en` 時取代 Huninn 的介面字與花字 | 同上 |

- **不要 Simplified 字型**（刪除 Noto Sans SC 與所有 SC 後備）。`--font-*` 後備鏈只留 TC：`"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif`。
- **WenKai 的數字太細**：牌上數字一律 Baloo 2，WenKai 只寫字（樣稿 `mock-play` 的「1杯」即此規則）。
- 刪除 Bangers、Impact、`ui-monospace` 數字。

### 3.2 自架子集（必做）

理由：Google Fonts 在部分網路被擋或很慢（本機測試就連不上），而且 CDN 分片在首屏造成字型閃爍。內容是靜態的，可以事先算好字集。

- 新增 `game/fonts/`：`huninn.woff2`、`noto-sans-tc-500.woff2`、`noto-sans-tc-700.woff2`、`noto-sans-tc-900.woff2`、`wenkai-tc-700.woff2`、`baloo2-800.woff2`、`dseg7-bold.woff2`，以及各字型的 `OFL.txt`（授權要求一起發佈）。
- 新增 `game/tools/fonts/subset.mjs`（或 `.py`）：掃描 `src/content.*.js`、`src/ui.js`、`src/art.js`、`src/days.js`、`src/hant.js` 的所有字串（**繁體輸出後**的字），加上 ASCII、全形標點、`…—～「」『』` 與 `0-9`，用 `pyftsubset`（`pip install fonttools brotli`）輸出 woff2。來源字檔從 npm `@fontsource/huninn`、`@fontsource/noto-sans-tc`、`@fontsource/lxgw-wenkai-tc`、`@fontsource/baloo-2`（皆 OFL）或各專案的 GitHub release 取得；來源檔不進 repo，只進子集。
- `tools/check-content.mjs` 加一項 F1：所有顯示字串的字都在子集內（缺字就失敗，提示重跑 subset）。
- 預估大小：Noto Sans TC 每個字重約 300–600 KB，Huninn 約 300 KB，WenKai 約 400 KB（以內容約 2,000 個不同字估）。`font-display: block` 只給 Huninn 與 Baloo（開店頁用），其餘 `swap`；開店頁照舊 `document.fonts.load(...)` 最多等 300ms。
- `index.html` 刪除 `fonts.googleapis.com` 的三行，改成 `<link rel="preload" as="font" type="font/woff2" crossorigin href="fonts/huninn.woff2">`（Huninn、Baloo 兩個）+ `style.css` 裡的 `@font-face`。

### 3.3 描邊字的使用範圍

允許描邊（`paint-order: stroke`）的只有：**花字 S1/S2、Logo 的「250」、飛行數字 +N、牌上的大數字不描邊**。
禁止：按鈕字、HUD、手勢小牌、卡片、字幕、事件面板、「啪」以外的任何介面字。現有 `.btn-label`、`.gchip-label`、`.g-pa`、`.combo-num`、`.vtoast`、`.start-title` 的描邊全部拿掉。
字距：中文不加 `letter-spacing`（刪除「現 點 現 做」的 6px 字距）。

---

## 4. 版面：全螢幕出血

### 4.1 舞台

- 保留 `.stage` 作為 **9:16 遊戲座標盒**（所有 % 與 cqw 座標不變，測試工具照舊量它）。
- 新增外層 `.frame`（在 `.app` 裡、`.stage` 外）：寬 = `.stage` 寬，高 = `min(100dvh, 寬 × 21/9)`，`overflow:hidden`，`container-type:size`。`.stage` 在 `.frame` 裡垂直置中，**`.stage` 改成 `overflow: visible`**（飛出去的顧客飛進出血區再出畫，而不是在黑邊被切掉）。
- 出血區畫面：上方延伸天花板深木（`--wood-dk`），下方延伸櫃台正面（`--counter` → `--counter-lo`）。由 `.frame` 的背景漸層畫，**不要黑邊**。
- 變數：`--bleed-t`、`--bleed-b` =（`.frame` 高 − `.stage` 高）/ 2，寫成 CSS `calc()`（container 單位）。
- 搬進出血區（負位移）：`.hud` 上移到 `max(env(safe-area-inset-top), 8px)`；`.subs`（字幕）下移到出血區底部、留 `env(safe-area-inset-bottom) + 10px`；`.gsurf`、`.overlay`、`.start-screen`、`.day-card`、`.letterbox`、`.gate`、`.flash` 的 `inset` 延伸到整個 `.frame`。
- 沒有出血時（桌機、16:9 以上寬）照舊在 9:16 內排；橫向桌機的兩側店面背景（`.app` 的 `@media (min-aspect-ratio:5/8)`）保留。

### 4.2 遊玩畫面座標（9:16 舞台 %；對照 `mock-play.png`）

```
出血上  HUD：左 排隊人數＋兩條細條；右 計時圈、暫停鈕（中/EN、消音移到暫停面板）
y  0–4%   天花板深木（HUD 沒出血時疊在這裡）
y  5–13%  背光壓克力菜單燈箱，x 4–96%，三格：翡翠檸檬 75｜珍珠奶茶 55｜（紅底）黃金比例 不能調
y 15–22%  叫號器 x 3–22%（完整入框）        監視器 x 77–97%（完整入框，轉 3°）
y 14–48%  店員：SVG 寬 66%，底邊貼櫃台檯面，頭頂 ≥ y 15%（不准擋燈箱）
y 26–30%  兩側不鏽鋼層架：每邊 3–4 個**不同**飲料 + 1 個雪克杯/封口機
y 48–51%  不鏽鋼檯面（高光線 + 底部暗線）；店員雙手、連擊杯塔放在檯面上
y 51–100% 櫃台正面（深紫壓克力，3 條直接縫）
  點單牌 中心 (32%, 53%)，**壓在檯面上緣**（舉起來的感覺）
  預告軌 x 60–97% y 53–60%：不鏽鋼橫桿 + 兩張夾著的小牌（取代「後面」）
  「現點現做」壓克力字 x 64–95% y 64–68%
  顧客半頭 寬 46cqw，中心 x 30%，可見 y 62–84%（眼睛、鼻子都要看得到）
  人龍剪影 x 62–100% y 70–100%（冷色）
出血下  字幕（無底帶，用漸層），Home 指示條上方
```

- 顧客頭比現在大 35%，**眼睛永遠不被字幕蓋到**。
- 按鍵模式（`?input=buttons`）：三鍵放在出血下區、字幕上方，見 §7.5。
- 刪除手勢模式那片「木條按鍵區」（`.stage[data-input=gesture] .pad` 的木紋條紋）；底部就是櫃台正面本身。

---

## 5. 角色

### 5.1 店員（`CLERK_SVG` 重畫；對照 `mock-parts.js clerk()`）

- 比例：頭寬 ≈ 舞台寬 50%；頭 : 可見身體 = 1 : 1.6；雙手搭在檯面上（手畫在檯面圖層**之後**，不被檯面蓋住）。
- 剪影辨識：**一撮翹毛 + 往右梳的斜瀏海**，32px 小圖也要認得出。刪除對稱刺蝟瀏海。
- 臉：五官**不對稱**——左眉平、右眉挑；嘴角往他的左邊勾（壞笑）；眼睛是半閉杏眼 + 粗上眼瞼線，瞳孔看向左下（顧客的位置）。鼻子用一筆勾鼻，不用兩點。
- 用色 ≤ 10 個填色：膚 3（本色/陰影/高光）、髮 2、制服 3（POLO 衫 + 領子）、圍裙 2、胸牌 1（紙色 + 紅字 Baloo「250」）。
- 陰影：臉右側一片、瀏海下一條、脖子一塊、制服右半身；頭髮一道邊光。
- 表情組（`data-mood` 名稱不變）：

| mood | 臉 | 姿勢 |
|---|---|---|
| idle（欠揍） | 半閉眼、挑眉、壞笑 | 雙手搭檯面，微呼吸 |
| polite（服務臉） | 眼睛彎成月牙、嘴笑太開露 8 顆牙、1 滴汗 | 雙手交握胸前（新姿勢 `a-bow`） |
| hit（爆罵） | 眉壓到眼上、眼白放大、嘴巴梯形大開見上排牙、額頭青筋 | 身體前傾、單手指出去 |
| perfect（秒回專業） | 眼睛正常張開、嘴一字、眉平 | 單手整理圍裙（tidy） |
| rage（爆氣） | 只剩眼白、鋸齒牙、頭頂蒸氣 | 雙手舉高 |
| over | 同 idle，頭偏 10° | 同 idle |

- 疊加 class `.squint`、`.crack`、`.brow`… 全部保留（劇本要用）。

### 5.2 顧客（`customerSVG` 改造）

- 頭寬 46cqw（原 34），`div.cust-clip` 高度改成露到鼻子下方（約 viewBox y 150）。嘴巴照舊平常裁掉、飛出時才露出。
- 變化來源不只髮型：**頭型 3 種**（圓 / 長 / 方下巴）× **眼型 3 種**（圓眼 / 瞇眼 / 下垂眼）× **眉 3 種** × 髮型 6 × 配件，用同一個種子決定。
- 背光處理：整顆頭疊一層 `rgb(14 17 32 / .10)`（或膚色用暗一階的版本），頭頂加一道暖邊光弧線。
- 一律仰望店員（瞳孔貼上緣），說話時眉毛動。
- 線寬 1.2cqw 外輪廓、0.7cqw 內線。
- 禁止（沿用設計規則）：不拿外貌、性別、族群當梗；沒有外送員；沒有奇幻元素。

### 5.3 前主管（Boss，第 7 天）

一定要跟一般顧客分得出來：頭寬 1.15 倍、油頭旁分、無框眼鏡、襯衫領 + 斜紋領帶露在櫃台上緣、掛識別證。每一步牌子照舊，但頭**完整可見到下巴**（Boss 不被裁）。

### 5.4 人龍

- 店外人龍：右下 3 個深度的冷色剪影（頭 + 肩，無五官），最前面那個最大、最暗。手機族加螢幕光。
- **刪除**現在站在櫃台前、穿彩色衣服的全身小人（`COUNTER_SVG` 的 `q-p*` / `q-c*` 與 `.g-pins` 的彩色版）；保齡球「瓶」改用這些剪影（被撞時往後倒 + 冷光閃一下）。
- 監視器裡的人龍維持小圓點人群，顏色改成冷色系 3 階。

---

## 6. 場景與各畫面構圖

### 6.1 店面背景（`SHOP_SVG`）

- 後牆：淺木直條板（不是磚），木條線 `--slat-line`，朝豎向消失點微收（沿用 VP 規則）。
- 光池：`radialGradient`（§2.3），吊燈兩盞（深紫燈罩），**取消** `.shop::before/::after` 的 CSS 光暈。
- 燈箱菜單：深紫框 + 白色背光面板；左兩格是飲料小圖 + 品名 + 價格（Huninn 品名、Baloo 價格），右格紅底「黃金比例／不能調」。劇本 E6 的金光改為「不能調」那格整格亮金 + 外圈光暈（`#goldsign` id 保留）。
- 叫號器：深色機殼、DSEG7 紅字，後面墊一層暗紅 `888` 鬼影。
- 監視器：深色機殼、暗藍綠螢幕、紅點閃；milestone 放大邏輯不變，裡面五段場景改成冷色夜景。
- 層架：不鏽鋼板；每邊 3–4 個不同飲料（奶茶褐、翡翠綠、檸檬黃、草莓粉）+ 1 個雪克杯或封口機。不准同一個杯子重複。

### 6.2 櫃台（`COUNTER_SVG`）

- 檯面：不鏽鋼漸層（`--steel-hi` → `--steel` → `--steel-lo`）+ 一條 2px 白色高光線 + 下方 8px 暗影。
- 正面：`--counter-hi` → `--counter` → `--counter-lo` 由上到下的漸層，3 條細直縫；右側「現點現做」壓克力字（Huninn、`--lemon` 字 + 細框，不加字距）。刪除舊的「銅牌」與木條。
- 連擊杯塔：檯面右端 x 82–96%，連擊 1–4 不顯示；5 起放 3 杯、10 起 5 杯、20 起 7 杯，杯子用 A 包提供的 `cupStackSVG(n)`；快嘴期間杯塔冒熱氣（2 縷 `--paper` 白煙往上飄）。

### 6.3 各畫面

| 畫面 | 構圖 | 對照 |
|---|---|---|
| 開店頁 | 店外夜景：遠方冷色樓房剪影 → 店面：紅白條紋遮陽棚 + 一串暖色燈泡 → 窗內暖光、店員欠揍探身 → 櫃台 → 路面暖光外溢 → 兩側人龍剪影。最上方 Logo 招牌（§7.2）。下方：一句標語、開店鈕、操作切換 | `mock-start.png` |
| 開場鐵門 | 鐵門用冷灰金屬 + 細高光橫條（不是純灰條紋），拉起時鐵門下緣一道暖光掃過地面 | — |
| 遊玩 | §4.2 | `mock-play.png` |
| 第 1 天打烊卡 | 號碼牌（No.001 / 250杯 / 兩個月後取餐）是主角，放大置中；下面一行「門口排了 88 人」；三種牌子的教學列改成三張迷你牌 + 鍵色字，無底框 | — |
| 結算（第 2–7 天） | 鐵門拉下的背景 + 一張**熱感紙收據**（§7.4） | `mock-summary.png` |
| 迷你事件 | 事件道具本身就是面板：大聲公 = 畫面左側一支大聲公探進來；前主管來電 = 一支手機從下方滑上來（螢幕顯示「前主管」來電）；計算機 = 一台真的計算機（DSEG7 數字）；蓋章連打 = 一疊單據 + 印章；拉鐵門 = 鐵門本身往下降。**不再用黃框黑卡面板** | — |

---

## 7. 介面元件系統

### 7.1 共通規則

- 圓角只有兩級：**小 2cqw**（小牌、切換鈕、迷你牌）、**大 4cqw**（按鈕、卡片、面板）。圓形按鈕用 50%。不准 99px 膠囊（除了暫停/計時這種圓鈕）。
- 邊框：紙色/金色物件 0.7cqw `--ink`；深色面板**沒有邊框**。
- 深色面板底色只有一個：`rgb(14 17 32 / .88)`（`--night-900` 88%）。
- 按鈕只有兩種：**主要**（金：`linear-gradient(#FFD54A,#FFB800)` + 0.7cqw `--ink` 框 + `0 1.4cqw 0 #B57A00`，Huninn 7cqw 深字）與**次要**（`rgb(255 247 230 / .08)` 底、無框、`--text` 字）。按下：`translateY(1cqw)`、投影縮成 0.4cqw，60ms。
- 呼吸動畫只給「現在唯一要按的主要鈕」，幅度 scale 1→1.03，1.2s。

### 7.2 Logo（開店頁、第 1 天結尾的 Logo 節拍）

- 背光壓克力招牌：`--ink` 底板 + `--paper` 面板 + 0.9cqw `--gun` 內框，整塊旋轉 −4°，後面一圈暖色光暈（`radialGradient`）。
- 字：「來」「杯」Huninn 400，`--ink`；「250」Baloo 2 800，**金漸層**（`--gold-hi` → `#FFD23A` → `#F29A00`）+ 2cqw `--ink` 描邊 + 7 層 1px 位移的 `#A85F00` 立體厚度 + 一道白色反光弧；「！」Baloo 800 `--gun` 描邊，**超出招牌右緣一點**（貼紙感）。
- 做成 `art.js` 匯出的 `LOGO_SVG`（文字轉外框路徑更好：用 Huninn / Baloo 的字形輪廓，避免字型未載入時跑版）。英文版：「250 CUPS!」同結構。
- 入場：招牌從上方掉下（260ms 回彈）→ 燈管閃兩下亮起（opacity 0.3→1→0.6→1，240ms）→ 「250」反光掃過。

### 7.3 HUD（遊玩中）

- 位置：上出血區（或天花板帶）。**沒有底板**（天花板本來就暗）。
- 左：人形圖示 + 排隊人數（Baloo 800、8cqw、`--lemon`），右邊兩條 16cqw × 1.2cqw 細條：氣勢（`--rim-cool`，左側墨鏡小圖示）、火氣（`--fury`，左側火焰小圖示）。**刪除「排隊」「氣勢」「火氣」文字標籤**（`.hud-label`、`.bar-label` 移除或 `display:none`，DOM 留著給工具）。
- 右：計時圈（9cqw 圓，環形剩餘時間 + 中間 Baloo 數字；最後 10 秒變 `--gun` 並輕跳）+ 暫停鈕。
- **中/EN、消音移到暫停面板**（新 `.pause-sheet`：繼續 / 中文·EN / 消音 / 操作模式）。`.tog` 類名保留在面板裡的按鈕上（工具會找）。開店頁、結算頁右上角照舊放兩個小圓鈕（EN、喇叭圖示）。
- 第 1 天照舊只顯示排隊人數（不顯示條與計時；工具 `qa.mjs`、`check-opening.mjs` 會檢查）。
- 連擊數字不在 HUD（改杯塔，§6.2）。`.hud-combo` 元素保留但永遠隱藏（`check-opening` 只檢查它在連擊 < 5 時不顯示）。

### 7.4 卡片

- **結算 = 熱感紙收據**（`showSummary`）：`--paper` 紙、上下鋸齒邊、旋轉 −1.2°、`0 2cqw 0 rgb(0 0 0/.35)` 投影。由上到下：小 Logo → 「第 4 天 · 250湊單日」→ 單號（Baloo，`NO.0004 · 90s`）→ 虛線 → 「門口排了」+ 大數字（Baloo 18cqw）+「人」，旁邊紅框小章「新紀錄」→ 三顆星（金星 / 虛線空星）各帶一行條件小字（★3 未解是「？？？」）→ 虛線 → 收據列（開罵 / 接待 / 最高連擊 / 被迫客氣，點線引導 + 右側 Baloo 數字）→ 「今日最狠」引言塊（Noto 900）→ 黑板條（WenKai，★ 空心圖示 + 謎題原文，**不寫「距離 ★3 還差」**）→ 「明天：回嘴日」→ 右上角紅色圓章（上排小字「打烊」+ 大字評級 C/B/A/S；S 且 250 結尾 = 金色章）。主要按鈕「開店（第 5 天）」放在收據**外面下方**。
- 收據高度超過可用高度時，收據內容可捲動，**按鈕永遠釘在底部可見**（修第 6 天按鈕被切的 bug）。
- 開店卡的「第 N 天」資訊（`start-day`）：一張掛在 Logo 下方的小木牌：「第 6 天 · 晚八點人潮」+ 規則一行；謎題放在黑板條；最高紀錄與星星用小字一行。
- 第 1 天打烊卡（`showClosing`）：深色面板（無邊框），號碼牌放大置中（不要擠在左上角），標題 Huninn 9cqw。
- 麥克風卡（`voicePrompt`）：深色面板、麥克風圖示、兩段字：「這家店要你親口罵。」「聲音只在手機裡處理，不會上傳。」主要鈕「允許，開罵」、次要文字鈕「算了，用手勢」。

### 7.5 按鍵模式的三鍵

- 位置：下出血區、字幕上方，高 20cqw。外觀改成**壓克力方塊**：鍵色底 + 頂部 30% 亮一階的高光帶 + 底部 1.4cqw 深色厚度（`--gun-deep` 等）；圖示在上、字在下；字用 Huninn 6cqw，**不描邊**（滾/閉嘴：白字；收：`--ink` 字）。
- `.btn`、`.btn-gun` 等類名不變。

### 7.6 手勢小牌

- 只在第 1 天開場的等待點、與之後的引導出現；其餘時間完全不顯示（現況已是第 1 天才有，維持）。
- 外觀：只有圖示 + 一個字（「滾」「閉嘴」「收」），鍵色圖示圈，深色底無框；**刪除動詞**「甩／連拍／按住」——動作由手指示範（`.finger` 動畫）表現。

### 7.7 字幕

- 無底帶；用下出血區由透明到 `--night-900` 92% 的漸層托住。
- 店員台詞：置中，Noto Sans TC 700，5.4cqw（長句 4.4cqw）；**爆點段**（`|` 之後）用 900、7cqw，顏色 = 該題鍵色（收用 `--lemon`），出現時 scale 1.25→1（120ms）。這就是「反差」：同一行裡前半小而平、後半大而紅，**不寫任何說明**。
- 顧客台詞：靠左，左邊 0.8cqw 圓角色條 = 牌子顏色，字色 `--text`。
- **舞台指示（括號內容）不再顯示**（刪除 `.sub .dir`）；畫面與聲音已經演了。
- 最多 2 行；一次只有一句。

### 7.8 預告（`setPreview`）

不鏽鋼橫桿 + 兩個小夾子夾著迷你牌（第二張縮小 80%、略淡），掛在櫃台正面右上。**刪除「後面」直排字**與半透明底框。

### 7.9 第 4 天湊單票（`setMeter`）

改成夾在預告軌左邊的一張檸檬黃收據小條：「已收」小字 + Baloo 大數字「N」+「/250」+ 下方 1cqw 進度細線（`--gun`）。接近 250（≥ 240）時紙條微微抖。達成時由 C 包的金章特效接手。

### 7.10 Toast / 提示

- 刪除 `.vtoast`、`.boo-text` 的黑膠囊樣式。被迫營業的噓聲改成從右邊人龍冒出的小對話泡（WenKai，`--paper` 底），最多 2 個。
- `tip()`（按錯吐槽、引導）：紙條樣式（`--paper` 底、`--ink` 字、鍵色左條），一次最多一個。

---

## 8. 特效語言

### 8.1 強度分級（只有三級，越高越少用）

| 級 | 時機 | 定格 | 震屏 | 鏡頭 | 其他 |
|---|---|---|---|---|---|
| 小 | 一般答題、補刀 | 40ms | 4px，沿顧客飛出方向 | 推近 1.04 → 回 | 粒子 3–5 個 |
| 中 | 蓄力 1、大單、Boss 每步 | 70ms | 8px | 推近 1.08 | 粒子 6–8 個；字幕爆點變大 |
| 大 | 調你媽、蓄力 2、250 命中、Boss 最後一步、爆氣開始 | 120ms | 12px | 推近 1.25 到 MOUTH | 白閃 40ms、細速度線 300ms、花字 1 個 |

- 震屏用**方向性**震動（沿飛出方向的 2 次衰減），不要隨機亂抖。
- 速度線：`--paper` 色、楔形 ≤ 1.2°、只蓋畫面外圈 30%（中心挖空），300ms。刪除現在的粗墨線 `.speedlines` 外觀。
- `prefers-reduced-motion`：鏡頭 ≤ 1.10、震屏減半、白閃與速度線關閉（沿用）。lite 模式：無粒子、無定格以外的動畫。

### 8.2 粒子（純 CSS transform、DOM 池化，同時 ≤ 12 個）

| 鍵 | 粒子 |
|---|---|
| 滾 | 3–5 顆冰塊（圓角方塊，`#DFF4FF` + 白高光）往飛出方向噴 + 牌子揉成紙團跟著飛 |
| 閉嘴 | 2–3 顆珍珠（深褐圓 + 小白點）彈跳落下 + 拉鍊線在嘴上畫過（現有） |
| 收 | 一團紅色印泥（`--gun` 不規則圓）蓋在牌上 + 一條收據紙從下方吐出 |
| 250 | 金色小杯子紙花 10 個 + 金章蓋下 |

### 8.3 花字規則（`huazi.js` + `ui.js hzOne`）

- 同一時間**最多 1 個**花字；花字之間至少 900ms。
- **只有這些可以出花字**：
  - S1「X你媽！」（調你媽）
  - S2「250」「二百五」「251」「520」與「黃金比例最好喝」
  - S1「滾！」「閉嘴！」「收！」**只在大級**（蓄力 2、Boss 最後一步）
  - S5「第 N 天」（開場、日卡）與「兩個月後」（開場、取餐日）
- 一般答題**不出花字**，改成字幕爆點放大（§7.7）。原本「每 3 位 1 個 S1」的規則廢除。
- **S3 黑條 OS：刪除**（它重複字幕）。真的需要旁白時走字幕。
- **S4 心聲：只准符號**（「？？？」、汗滴、驚嘆、問號泡泡、閃光），不准文字（刪除「自信」「呆住」「還在調」等）。
- 位置：花字不准蓋到店員的眼睛到嘴巴（y 17–31%），預設放在店員胸口到檯面（y 34–46%）；不准壓牌子（沿用 4cqw 規則）。
- 外觀：S1 = `--lemon` 字面 + 1.6cqw `--gun-deep` 內描邊 + 2.8cqw `--ink` 外描邊（原 2.6/4.6 太胖）；S2 = 金漸層 + `--ink` 描邊 + 一道反光；英文用 Baloo 2 800。光芒放射底只給 S2 的 250。
- 擬聲字「啪」：一次一個、WenKai 700、7cqw、單層 0.5cqw `--ink` 描邊、不放大到 13cqw；連拍第 3 下改成 1 個較大的「啪」+ 一圈衝擊線，不疊三個。

### 8.4 三拍反差怎麼「演」（核心）

1. **鋪陳**：店員 `polite`（服務臉）或 `idle`+`squint`，字幕前半小字慢慢出。
2. **爆點**：硬切 `hit`（0ms，不過場）+ 定格 + 鏡頭推近 + 字幕爆點詞放大成鍵色 + 顧客飛出 + 粒子。
3. **秒回專業**：120ms 後硬切 `perfect`（整理圍裙）、鏡頭 240ms 拉回、字幕恢復。

這三拍就是「反差」，**畫面上不寫任何形容詞**。吼罵模式的反差加分（+2）直接併進飛向監視器的 `+N`，不另外顯示。

---

## 9. 刪除清單（遊玩畫面上的說明字）

| 現在 | 在哪 | 處理 | 用什麼取代 |
|---|---|---|---|
| 「反差！」S1 | `main.js` `vtext().contrast` → `ui.huazi` | **刪除** | §8.4 三拍演出 + 監視器 `+N` 變大一級；`__250.voice.stats.contrast` 照樣計數 |
| 「反差 +NdB」 | `main.js` `voiceToast(contrastDb)` | **刪除** | 不顯示。音量計的指針在爆點瞬間跳到頂並彈一下 |
| 卡拉 OK 標籤「小聲客氣」「大聲罵！」 | `ui.js VOICE_TEXT.setup/punch`、`.kk-tag` | **刪除** | 台詞本身：前半小字、後半大字（§10） |
| 音量計刻度字「說／罵／吼」 | `.vm-mark` | **刪除** | 三道無字刻痕 |
| 音量計狀態「安靜一秒……／開罵！／回放中」 | `.vm-status` | **刪除** | 校準：麥克風圖示 + 三點脈動；回放：牆上大聲公圖示發出聲波 |
| 牌角倍率「×2／×1.5／×1.2」 | `ui.setSignMult`、`.sign-mult` | **刪除** | 牌子計時條在快速窗口內有一段金色閃光（「現在最划算」）；倍率的回報 = 打擊等級與 +N 大小 |
| 「快嘴 ×N」膠囊、「快嘴！」花字 | `ui.setQuick`、`.hud-quick`、`main.js` quick huazi | **刪除** | 杯塔冒熱氣 + 畫面左右邊緣淡淡的速度線 + 進入時一聲「咻」 |
| 「×N 連擊」 | `.hud-combo` | **隱藏** | 檯面杯塔（§6.2） |
| 「爆氣！」花字、「一把掃過去！」黑條 | `main.js` rage | **刪除** | 紅色暈影 + 吊燈晃 + 店員 rage + 人頭湧上；第一次爆氣用手指示範長劃（無字） |
| 「後面」 | `setPreview` `.preview-label` | **刪除** | 預告軌夾子（§7.8） |
| 手勢小牌動詞「甩／連拍／按住」 | `GESTURE_TEXT.verb` | **刪除**（只留鍵名） | 手指示範動作 |
| 「連拍三下！」提示 | `gestureHint` | 第 1 天保留**一次**；之後改成手指在臉上點三下的示範 + 三個漣漪 | — |
| 「全倒！／STRIKE!」 | `main.js` `ui.bowl(k, text)` | **刪除文字** | 三個剪影依序倒下 + 球瓶聲 + 鏡頭往右輕推 |
| 「啪！兩個月」 | `GESTURE_TEXT.stamp` | **改** | 印章蓋在額頭留下紅色「兩個月」印記（印記本身是道具，不是說明） |
| 「+58」常駐膠囊 | 櫃台右側 `+N` pill | **刪除** | 只保留飛行的 `+N`（落進監視器） |
| S3 黑條（「還在想？」「15杯？」…） | `huazi.js` 50/40 分規則 | **刪除** | 字幕已經有 |
| S4 文字（「自信」「呆住」「還在調」） | opening / huazi | **改成符號** | 顧客表情 + 汗滴 / 問號 |
| 字幕裡的舞台指示「（拿出水桶）」 | `.sub .dir` | **刪除** | 動作由畫面演 |
| 事件面板「狂拍！」「+2」黃框卡 | `showEvent` | **刪除面板** | 事件道具本身（§6.3）+ 計數直接寫在道具上（大聲公音量格、計算機螢幕、單據疊高） |
| 拉鐵門「拉鐵門！+9 狂拍！」 | `showEvent('shutter')` | **刪除面板** | 鐵門本身 + 飛行 `+N` |
| 排隊里程碑卡「10+ 排到門口了！你要幾杯？」 | `showMilestone` `.ms-card` | **刪除卡片** | 監視器放大（保留）；那句話走字幕 |
| 進場日卡橫幅 | `dayBanner` | **保留**但改外觀 | 掛牌從上方垂下 1.6s（Huninn 標題 + 規則一行），無黃框 |
| 結算「評級」字、「距離 ★3 還差：」 | `showSummary` | **刪除字** | 圓章、黑板條（§7.4） |
| 結算「今日最大聲：N 分貝級」 | `loudestRow` | **改** | 收據一列「最大聲 …… 99 dB ▶」（▶ 是重播鈕） |
| HUD「排隊」「氣勢」「火氣」「秒」 | `.hud-label`、`.bar-label`、`.hud-tunit` | **刪除字** | 圖示 |

保留（是道具或遊戲必要資訊）：燈箱菜單字、「現點現做」、叫號器、胸牌 250、號碼牌文字、點單牌文字、字幕、開店卡規則一行、結算收據。

---

## 10. 吼罵模式畫面

- **要說的台詞就放在字幕位置**（取代那一刻的字幕；`.karaoke` 元素保留，搬到字幕位置），沒有框、沒有標籤：
  - 第一行（鋪陳）：Noto Sans TC 500、4.6cqw、`--text` 55% → 隨玩家聲音逐字亮成 100%。
  - 第二行（爆點）：Noto Sans TC 900、8cqw、`--text` 40% → 逐字亮成鍵色（收用 `--lemon`），音量越大字越大（scale 1 → 1.15，跟著音量）。
  - `.karaoke.lit` 類名與 `karaokeProgress()` 介面不變（`check-voice.mjs` 會檢查）。
- **音量計**：櫃台正面右緣一根細膠囊（2.4cqw 寬、28% 高），上方一個大聲公小圖示。填色由下而上 `--rim-cool` → `--lemon` → `--gun`；三道無字刻痕對應 說／罵／吼。到「吼」：膠囊抖 + 大聲公冒出兩圈聲波。爆點瞬間指針衝頂彈一下（這就是反差的回饋）。
- **回放**：店內牆上加一支大聲公（吼罵模式才出現），回放時它發出聲波圈。
- **不顯示**：dB 數字、「反差」、任何形容詞。
- 結算收據多一列「最大聲 …… 99 dB ▶」。

---

## 11. 實作計畫：3 個並行工作包（檔案 / 段落不重疊）

> 共通：`style.css` 依段落註解切分，**每包只改自己擁有的段落**；新規則加在自己的段落內。`:root` 只有 B 改，且 B 第一個 commit 就把 §2.1 整張表寫好（A、C 從第一天就用新變數名）。`ui.js` 依函式切分（下表）。共用介面先約定：A 匯出 `cupStackSVG(n)`、`LOGO_SVG`、`MEGAPHONE_SVG`、`PARTICLE_SVG = { ice, pearl, ink, paper, cup }`；C 呼叫它們。

### A 包：場景美術

- **檔案**：`src/art.js`（全部，除了 C 需要的新匯出由 A 提供）、`art-demo.html`、`test/art.test.mjs`。
- **`style.css` 段落**：`Shop background`（`.shop`、`.lb-text`、`.goldsign`、`.gs-*`、`.caller-*`、`.gate-tag`）、`Door monitor`（`.monitor`、`.mon-*`、`.snake`）、`Counter`（`.counter`、`.plaque-text`、`.q-*`）、`Clerk`（`.clerk*`）、`Customer`（`.cust-wrap`、`.cust*`）、`Order signs`（`.sign*`，**除了** `.sign-mult` 由 C 刪）、`mini signs`、`.group-head`、`.rage-head`、`.g-pins`/`.g-pin`、`.ticket`、`.gate`、`.shutter-fx`、`.tint`（換成 §2.3 的暈影做法）。
- **`ui.js` 函式**：`renderCustomer`、`signMarkup`、`gestureBadge`、`mountSign`、`swapSignContent`、`paintMonitor`、`setTicket`、`goldsign`、`setClerk`/`setClerkFlags`/`resetClerk`（只改 DOM/類名，時序不動）、`bowl` 的圖形部分、`rageHeadAdd`、`showGroup`/`groupHit` 的圖形部分。
- **工作順序**：
  1. P0 `SHOP_SVG`：木條牆 + 光池 + 燈箱 + 叫號器 + 監視器 + 層架（§6.1）。
  2. P0 `COUNTER_SVG`：不鏽鋼檯面 + 深紫正面 + 「現點現做」；刪除櫃台前彩色小人與銅牌（§6.2、§5.4）。
  3. P0 顧客放大到 46cqw、改裁切、背光邊光（§5.2）、座標（§4.2）。
  4. P1 `CLERK_SVG` 重畫（§5.1），新姿勢 `a-bow`，雙手畫在檯面之後。
  5. P1 顧客頭型/眼型/眉型變化；前主管專屬造型（§5.3）；人龍剪影（§5.4）。
  6. P1 點單牌：數字改 Baloo、計時條金色快速窗口（`.sign-timer` 內加 `.sign-timer-hot`，由 `startSignTimer` 的 steps 控制，C 不碰）、線寬（§2.5）。
  7. P2 `LOGO_SVG`、`cupStackSVG`、`MEGAPHONE_SVG`、粒子 SVG、事件道具 SVG（大聲公、手機、計算機、單據疊）。

### B 包：介面外框、字型、版面

- **檔案**：`index.html`、`game/fonts/*`（子集 + OFL.txt）、`tools/fonts/subset.mjs`（新）、`tools/check-content.mjs` 加 F1、`test/ui.test.mjs`（版面相關）。
- **`style.css` 段落**：`:root`、`Stage frame`（新增 `.frame` 與出血）、`Off-stage backdrop`、`HUD`（`.hud*`、`.bar*`、`.tog`、新 `.pause-sheet`）、`Subtitle band`（`.subs`、`.sub*` 的**版面與字型**；爆點樣式由 C 定義在 `.sub-punch`）、`Keys`（`.pad`、`.btn*`、`.ring`、`.key-lock`）、`Start page / closing card / recap`（`.overlay`、`.card*`、`.report*`、`.stat*`、`.best*`、`.big-btn`、`.start-*`、`.day-card`、`.dc-*`、`.recap*`）、stage 2 的 `.preview`（容器）、`.meter`、`.day-banner`/`.db-*`、`.start-day`/`.sd-*`、`.report-rate`/`.rate-badge`/`.report-*`、gesture 段的 `.gchips`/`.gchip*`/`.input-tog`/`.it-opt`、voice 段的 `.voice-opts`/`.vo-*`/`.voice-prompt`/`.vp-*`/`.loudest*`、`.skip`、`.tip`、`.milestone`/`.ms-*`。
- **`ui.js` 函式**：檔頭的 `FONT_ZH`/`FONT_SIGN`/`FONT_EN`、`DECOR`/`DEFAULT_UI`/`GESTURE_TEXT`/`VOICE_TEXT` 的**介面字**（C 只刪 `setup`/`punch`/`marks`）、`makeBar`、`applyTexts`、`setTexts`、`setHud`、`render` 的 HUD 部分、`paintQueue`/`setQueue`、`setBar`/`showBar`、`preloadFonts`/`fontsReady`、`showStart`、`startButton`、`miniSign`、`showClosing`/`closeClosing`、`showRecap`、`showSkip`、`showSummary`、`loudestRow`、`setVoiceOptions`、`voicePrompt`、`setPreview`、`setMeter`、`dayBanner`、`tip`、`showMilestone`/`relabelMilestone`（刪卡片）、`showEvent`/`updateEvent`/`hideEvent`（改成驅動道具，道具 SVG 由 A 提供）、`coverKey`、`breathKey`、`guide` 的按鍵/小牌外觀、新的暫停面板。
- **工作順序**：
  1. P0 `:root` 色票（§2.1）與字型自架（§3.2），刪 Google Fonts 與 SC 字型。
  2. P0 `.frame` 全螢幕出血、`.stage` overflow visible、HUD/字幕搬進出血區、safe-area（§4.1）。
  3. P0 結算收據（§7.4），含「按鈕永遠可見」。
  4. P1 HUD 改版 + 暫停面板（§7.3）；開店頁 Logo 版面（用 A 的 `LOGO_SVG`，A 未完成前先用 HTML 文字版照 `mock-start.html`）。
  5. P1 按鈕、卡片、麥克風卡、第 1 天打烊卡、預告軌、湊單票、日卡掛牌（§7.1–7.9）。
  6. P2 事件面板改道具驅動（與 A 對接）。

### C 包：特效、刪說明字、字幕/卡拉 OK/花字

- **檔案**：`src/huazi.js`、`test/huazi.test.mjs`、`src/main.js`（只動：`vtext()` 的 `contrast`/`contrastDb`/`calib`/`ready`/`deaf` 用途、反差 `voiceToast`/`huazi` 呼叫、快嘴花字、爆氣花字/提示、`ui.bowl` 的文字參數、`ui.setSignMult` 呼叫、`ui.setQuick` 呼叫改成 `ui.setCombo`）、`tools/check-voice.mjs`（若檢查項依賴被刪的文字）。
- **`style.css` 段落**：`Huazi layer`（`.hz*`）、`Effects`（`.flash`、`.speedlines`、`.letterbox`、`.finger`、`.guide-line`、`.star-pop`、`.tip-layer`）、`Shake`、`Floating FX`（`.fx-layer`、`.float`、`.boo-text`、`.gain-fly`、`.vtoast`）、`.sign-mult`（刪）、`.hud-quick`/`.quick-*`（刪）、`.hud-combo`/`.combo-*`（隱藏）+ 新 `.cup-stack`、gesture 段的 `.g-trail*`、`.g-stamp*`、`.g-pa*`、`.g-hint`、`.finger[data-g]`、voice 段的 `.karaoke`/`.kk*`、`.vmeter`/`.vm-*`、新 `.sub-punch`、新 `.particles`/`.pt-*`。
- **`ui.js` 函式**：`hzOne`、`rays`、`huazi`、`clearHuazi`、`huaziTracked`、`emphasize`、`showLine`（爆點分段 `.sub-punch`、刪 `.dir`）、`karaoke`/`karaokeProgress`、`voiceMeter`/`voiceLevel`/`voiceStatus`/`voiceToast`、`floatText`、`queueGain`、`effect`、`flash`、`speedLines`、`shake`（改方向性）、`freeze`、`camera` 的推近參數、`clerkBeat`（三拍時序 §8.4）、`kick`、`customerReact`/`signExit`/`signFx` 的特效與粒子、`slap`、`stampHold`/`stampSlam`、`bowl` 的文字刪除、`setSignMult`（變 no-op）、`setQuick`（變 no-op）+ 新 `setCombo(n, quick)`（用 A 的 `cupStackSVG`）、`starPop`、`setForced`、`gestureHint`。
- **工作順序**：
  1. P0 刪除清單 §9 裡屬於 C 的全部（最快見效：一天內做完）。
  2. P0 花字規則改寫（§8.3）：`pickHuazi` 只回傳允許的詞；刪 S3；S4 只回傳符號；`createHuaziTracker` 改「同時 1 個、間隔 900ms」。單元測試同步改。
  3. P0 字幕爆點 `.sub-punch`（§7.7）+ 三拍演出（§8.4）。
  4. P1 強度三級 + 方向性震屏 + 新速度線（§8.1）。
  5. P1 吼罵模式：卡拉 OK 搬到字幕位置無標籤、音量計改版（§10）。
  6. P2 粒子（§8.2）、杯塔連擊 `setCombo`、快嘴邊緣速度線。

### 交付與驗收（每包都要）

- `node --test test/*.test.mjs`、`node tools/check-content.mjs` 全過。
- 瀏覽器：`play-integrate.mjs`、`qa.mjs`（360×640 與 390×844）、`check-opening.mjs`、`check-signature.mjs`、`check-gesture.mjs`、`check-voice.mjs`、`shot-stage2.mjs` 全過、無 console 錯誤、無元素超出 `.frame`。
- 工具依賴、**不能改名或刪掉的 DOM**：`.start-screen .start-btn`、`.stage`、`.subs`（`.subs .em` 仍用於強調）、`.sign[data-state=…]`、`.sign-card`、`.sign-num`、`.sign-line`、`.sign-timer`、`.day-card .dc-btn(.ready)`、`.overlay.summary .report/.card/.big-btn`、`.hud-qnum`、`.hud-combo`、`.hud-time`、`.bar-aura`、`.bar-fury`、`.tog`、`.pad .btn`、`.preview`、`.meter`、`.event-panel`、`.day-banner`、`.group-row .group-head`、`.rage-head`、`.karaoke`（含 `.lit`）、`.loudest-text`、`.loudest-btn`、`.voice-prompt`、`.vp-yes`、`.input-tog .it-opt`、`.hz`/`.hz.placed`/`.hz-layer`、`.letterbox`、`.skip`、`.recap`、`.plate-layer .ticket`、`.finger`、`.guide-line`、`.monitor[data-zoom]`、`.cust-wrap[data-face]`、`.flash`。要改外觀可以，類名與存在性要留；`.event-panel` 改成道具時保留這個類名在道具容器上。
- 視覺驗收：在 390×844、360×640、1280×800 截同一組畫面（開店、開場 4 個等待點、調你媽、第 1 天三種手勢、打烊卡、第 2 天快嘴、第 3 天爆氣、第 4 天湊單、第 6 天團體、第 7 天 Boss、一個迷你事件、結算、吼罵模式卡拉 OK），逐張對照：
  1. 沒有黑邊（390×844）；
  2. 遊玩中任何時刻說明字 ≤ 字幕 1 行 + 花字 1 個 + 飛行數字 1 個；
  3. 顧客眼睛完整可見、Boss 可辨認；
  4. 燈箱菜單、叫號器、監視器完整入框且不被店員擋；
  5. 結算按鈕在三種尺寸都完整可見；
  6. §9 刪除清單裡的字一個都找不到（可用 `page.content()` 搜尋：反差、快嘴、×1.5、×2、後面、全倒、STRIKE、小聲客氣、大聲罵、分貝級、評級、距離 ★3）。
- 文件同步：`CLAUDE.md` 的目錄樹加 `game/fonts/`、`tools/fonts/`；`docs/first-minute-spec.md` §2 開頭加一行「美術規範以 `docs/art-direction-v2.md` 為準」。
