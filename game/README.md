# 来250杯！ / 250 Cups!

A playable web prototype of a vertical (portrait) phone comedy game. You play a cocky bubble-tea clerk on a very high counter in a Taiwanese night-market tea stand. Customers peek up from below, hold up an order sign and say their order. Answer each one with **滚 / 闭嘴 / 收** (Scram! / Zip it! / Booked!). The sign's colour is the key's colour. The ruder you are, the longer the line gets. The only way to lose is being too slow: then the clerk is forced into a sugary service voice and the shop boos.

The first minute follows [`docs/first-minute-spec.md`](../docs/first-minute-spec.md) (art, the day 1 opening script, pace, 花字 captions, days 1–7). Where it conflicts with `docs/game-design.md`, the spec wins. Gameplay rules follow [`docs/gameplay-v2.md`](../docs/gameplay-v2.md) where it says so; stage 1 ("手感地基": jab + next, speed multiplier, frozen combo on a wrong key, the rage rework, forced politeness instead of an early close) and stage 2 ("关卡": preview + fast mouth, one rule per day, mini events, the shutter, stars / rating / bests) are in; stage 3 (the three-key line matrix, comebacks, collection) is not.

The prototype uses plain HTML, CSS and native ES modules, with no dependencies and no build step. All art is inline SVG/CSS (`src/art.js`, `style.css`; no images, no emoji, no filters). All sound effects are synthesized with WebAudio. Voice lines play from the generated AI voice pack in `voice/` (Kokoro-82M, see `tools/voice/README.md`); lines without a clip fall back to the browser's Web Speech API.

## Run

```bash
cd game
python3 -m http.server 8765
# open http://127.0.0.1:8765/  (phone: same LAN IP; use portrait)
```

Opening the page with `file://` will not work because ES modules need a server.

URL parameters:

| Param | Effect |
|---|---|
| `?lang=zh` / `?lang=en` | Starting language (any `zh-*` tag, e.g. `?lang=zh-TW`, means Chinese). Otherwise the saved choice, then `navigator.language`: any `zh*` browser gets Chinese, everything else English. Chinese is always Traditional with Taiwan wording; there is no Simplified build. |
| `?bleep=1` | Starts with bleep mode on (調你媽 → 調你嗶). |
| `?input=gesture` / `?input=buttons` / `?input=voice` | Controls: gestures on the customer (default), the three-button pad, or 吼骂模式 (voice mode: gestures plus the microphone, asked for on start). Otherwise the saved choice (the start card toggle 手势 / 按键 / 吼). J / K / L work in all of them. |
| `?whisper=1` / `?replay=0` | Voice mode: 小声模式 (lower thresholds), turn the self-replay off. Otherwise the start card switches (`250cups.whisper`, `250cups.replay`, default on). |
| `?day=N` | Start on day N (1–7) instead of the saved day. |
| `?skipOpening=1` | Day 1 starts free play directly (QA). |
| `?debug&first=78,63,47` | The listed customer ids come first in every round (QA: a deterministic draw). |
| `?seed=N` | Seeded randomness (QA). |
| `?lite=1` / `?lite=0` | Force the K4 lite mode (camera cuts, no idle loops) on or off; otherwise it switches on by itself on slow devices. |
| `?punchfx=0` | Turn the runtime voice punch off (plain spec 8.5 punch chain) for A/B listening; on by default. |
| `?debug` | Exposes `window.__250` for automated tests: getters `game`, `opening`, `day`, `info`, `lang`, `inputs` (press outcomes this round: `answer` / `wrong` / `step` / `buffered` / `jab` / `next` / `rageStart` / `rage` / `rageMiss` / `event` / `group` / `holding` / `late` / `dead`), `lastEval` (stars / rating of the last finished day), plus `audio`, `ui`, `getContent`, `DAYS`, `evaluateDay`, `loadBest`, `startDay(n)` and a `durationMs` setter that shortens the next rounds; gesture mode adds `gestures` (presses by gesture and outcome, `swipe:answer`, `taps:answer`, `hold:answer`, `swipe:strike`, `swipe:rage` …, counted for the whole session), `inputMode` and `setInputMode(mode)`; voice mode adds `voice` (`ready`, `stats` { onsets, answers, charge2, contrast, contrastDb, rage, replays, opening, jab, event, keywords, jackpot, peaks }, `floor`, `db`, `level`, `loudestDb`, `canRecord`). |

Saved in `localStorage` (every access is wrapped in try/catch): `250cups.day` (only goes up), `250cups.openingDone`, `250cups.lang`, `250cups.bleep`, `250cups.input` (`gesture` / `buttons`), `250cups.best.N` (best queue of day N), `250cups.stars.N` (every star of day N ever reached: bit 1 = ★1, 2 = ★2, 4 = ★3).

## The flow

1. **Start card** (3.2): the title slams down, the tagline fades in, from 1200 ms the big button "点一下 开店" (later "开店（第 N 天）") breathes; a tap before that starts the shop too. That tap also unlocks audio; the game waits at most 300 ms for the fonts.
2. **Day 1 opening script** (section 3, `src/opening.js`, about 33 s): the shutter rolls up, "你要几杯？", customer 1 "嗯……" (teaches 滚), customer 2 "15杯！" (滚 again), customer 3 "250杯！" (teaches 收: "好，250杯什么？"… "冰块甜度要不要调？" "少甜少冰！" teaches 闭嘴) → "调你妈！" → "黄金比例最好喝！" → "我们都是现点现做，250杯，两个月后过来拿。这是你的取餐号码牌。" → "下一位！", logo, a three-key recap. The engine stays `idle` the whole time; there is no timer. Each wait point escalates hints (glow → counter taps → finger and dashed line), a first wrong key gets a quip, a second wrong key makes the clerk do it himself ("算了，我自己来。"), a 5 s timeout plays the service voice once. Nothing costs points. The 12 people in line carry into day 1.
   Once the script was completed, a later day 1 (for example after quitting mid-day) replays it with "跳过 ▸" after 1200 ms, which jumps to the recap.
3. **Day 1 free play** (45 s): fixed first three customers (1 杯 → 100 杯 → 可以少冰吗？), then a weighted mix. The HUD shows only the queue (no bars, no clock, combo only from 5).
4. **Closing card** (3.8): the day's last line is read first, then the verdict, then the card: the ticket "No.001 / 250杯 / 两个月后取餐" with today's savagest line, "第一天 打烊" / "门口排了 N 人" on two lines, the three sign types with their keys, stars, and a centered button "开第二天 ▸" that works from 1000 ms on (taps elsewhere and J/K/L do nothing, so a player still mashing cannot skip it).
5. **Days 2–7** (90 s each, one rule per day, [`docs/gameplay-v2.md`](../docs/gameplay-v2.md) 5): the start card and a 2.2 s banner at round start show the day's name, its rule in one line and the ★3 blackboard riddle; then day 2 午休潮 (preview + fast mouth; timeouts and the swagger bar), day 3 原片日 (the two-step original customer 4–6 times; rage), day 4 250 凑单日 (the ticket meter; hold-to-charge), day 5 回嘴日 (the ex-boss's phone call; the comeback mechanic is stage 3), day 6 晚八点人潮 (group boxes, change-order customers, the 249 trap), day 7 Boss 前主管 (eight steps, the last one a full hold). One 5–8 s mini event mid-round and the last 5 s 拉铁门 on every day from 2. The report card shows ★1 (queue; day 7: beat the boss), ★2 (the rule goal), ★3 (the riddle, "？？？" until solved, with "距离 ★3 还差：<riddle>"), the rating C / B / A / S (gold "250" for S with a queue ending in 250), "新纪录！" and the best so far, and tomorrow's rule. ★1 opens the next day, otherwise the day is replayed. A day only ends by its clock: running out of swagger means 10 s of forced politeness, never an early close.

Per customer (4.1): head pops up → sign rises (signUp) → the customer talks once the clerk is quiet and the clerk's subtitle has been read → the answer window starts when they finish (t0; on day 1 `talkLeadMs` = 400 ms before the voice ends, clamped to signUp + 250…1600 ms) and shows as a bar on the sign → press → the sign leaves at once, the clerk's line plays as setup | silence | punch with the three-beat face, 花字, "+N" flying into the door monitor and the customer flying out on the punch → a silent landing L after the punch, in whose tail the next head pops and the sign rises, so the next customer talks when L ends. The sign is up only once the punch 花字 have played and the subtitle has been read (a voiced line: voice end + 300 ms, at least 1000 ms and 100 ms per character; otherwise max(1500 ms, 140 ms per character)), and the head never pops before the old customer has flown off. A new customer cancels 花字 that have not started and resets the clerk's pose; its rising sign clears any 花字 in its way.

Controls: **gestures on the customer** (default, below), or the three-key pad (`?input=buttons` / the start card toggle "操作 手势 / 按键"), or **J / K / L** in both modes. With keys a press resolves at once; holding on to 300 / 800 ms upgrades that same answer (charge level 1 / 2). Enter or Space taps the visible card. **中/EN** and **消音 / Bleep** work everywhere.

**Gesture mode** ("手势", [`docs/gameplay-v2.md`](../docs/gameplay-v2.md) 9; `src/gesture.js` recognizes, `main.js` maps). The pad is gone: the bottom 20% is a wooden counter top that also takes gestures, with three tiny chips (甩 滚！ / 连拍 闭嘴！ / 按住 收！) on day 1 only. The whole stage below the HUD is the surface (pointer events, mouse too). A stroke is decided as soon as it is unambiguous: past 40 px it is a swipe (a shorter fast flick on release), held 180 ms without moving it is a hold, released sooner it is a tap.

**Voice mode** ("吼", 吼骂模式, [`docs/gameplay-v2.md`](../docs/gameplay-v2.md) 10; `src/voice.js` analyses, `src/mic.js` listens, `main.js` maps). The player says the clerk's lines out loud. Picking 吼 (or `?input=voice` and a tap on start) shows a card first ("这家店要你亲口骂。允许麦克风？声音只在手机里处理，不会上传。"); a refusal or a missing microphone falls back to gestures with a friendly line. The microphone (echo cancellation on, noise suppression and auto gain off) is analysed on the device only: RMS → dBFS every 20 ms, the room's noise floor from the first quiet second, then 说 / 骂 / 吼 at floor +12 / +22 / +30 dB (小声模式 +7 / +13 / +19), an onset needs 120 ms. Nothing is uploaded or saved; a 3 s ring buffer in memory feeds the replay. When a customer arrives the line to say (the sign's best-key reply) takes the subtitle slot as a plain line, no labels: the setup small and dim, the punch big; it lights up as the player speaks (the punch in the key colour, growing with the voice). The loudness meter is a thin capsule with three unlabelled notches and a megaphone icon; calibration shows a mic with three pulsing dots, a replay makes the shop megaphone on the wall send rings (docs/art-direction-v2.md 10). A shout reaching 骂 answers with the sign's best key (voice is never "wrong"), charge 1 (吼 = 2), the speed multiplier as usual, the customer reacts on the shout's peak, and the AI clerk does not speak that line (it still speaks system lines, forced politeness and answers by gesture or key; customers and the boss keep their voices). A soft setup (说, ≥ 300 ms) and then a roar for the same customer is the 反差 bonus: +2 (joined into the flying +N), the meter's needle hits the top and bounces, the clerk's face polite → yell → professional. Nothing names it on screen (art-direction-v2 9). After the shout ends it is replayed through the shop megaphone (the voice punch chain, +6 dB, ×1.06; the microphone is ignored while it plays). In rage every 300 ms of sustained 骂 voice flings a head (吼: two); events take a held shout (the calculator runs while the shout lasts). The summary / closing card shows "今日最大声：N 分贝级" (peak dBFS + 110) with a replay button (memory only). The optional "听懂我骂什么" switch (only where `SpeechRecognition` exists, off by default, with a note that the browser's recognizer may use a cloud service) maps 滚 / 闭嘴 / 收 words to keys and 二百五 / 250 to a +5 jackpot. Gestures and J / K / L keep working in voice mode.
- **甩 = 滚**: swipe across or on the customer. They are flung that way with the swipe's speed (50 ms hit-stop, then velocity, spin, gravity, off screen). ≥ 0.8 px/ms = charge 1, ≥ 1.5 px/ms = charge 2 (big landing, mega). A right / up-right fling (−30° … 75°) after a correct 滚 bowls into the queue silhouettes at the right edge: +1 per head (≥ 1.0 / 2.0 / 3.2 px/ms = 1 / 2 / 3); the silhouettes topple one after another and the camera leans right (no "STRIKE" text).
- **连拍 = 闭嘴**: taps on the face; each one a "啪" (synth `slap`, squash, a caption pop, small shake; no marks). The 3rd tap of a burst (taps ≤ 350 ms apart) answers 闭嘴; the 4th / 5th charge it to 1 / 2; later ones are jabs and then "下一位". One or two taps alone answer nothing (a "连拍三下！" hint), so a stray touch is never a wasted answer.
- **按住盖章 = 收**: press and hold on the customer: a gold stamp grows above the head (charge 0 / 1 / 2 at 300 / 800 ms) and their timer freezes (`game.aim`); release slams it on the forehead ("啪！两个月") and they slide off (`press('take', holdMs)`, timed from the hold start). At full charge it slams by itself after 450 ms. The boss's last step is a full stamp hold.
- Every gesture works on every customer (an off gesture is an off-key curse: +1, combo frozen, no penalty). With nobody to answer (landing, rage, events, the shutter, a full fury bar) every tap / swipe / hold is a press: a jab, "下一位", a rage hit, the mash. Mini events: 大声公 / 拉铁门 = mash taps anywhere, 前主管来电 = swipe the phone away, 计算机 = hold and release on 250, 盖章连打 = rapid taps (counted as 收). Rage: the heads pop in a row and stay 1.2 s (`rageLiveMs`); one long swipe flings every head it crosses (Fruit Ninja). Group box: one swipe flings a 滚 group, a 闭嘴 group takes a tap per head, a 收 group a short stamp per head.
- In gesture mode the sign's corner badge shows the best gesture (↗ fling / two palms / stamp) instead of the key picture; guides light the chips and the finger acts the gesture out on the customer; the opening's wait points take the matching gesture. Haptics (`navigator.vibrate`, try/catch) per gesture.

Gameplay v2 stage 1 ([`docs/gameplay-v2.md`](../docs/gameplay-v2.md) 3–4), on top of the flow above:

- **Every press answers.** While the answered customer flies (from the answer until the punch line ends + 200 ms) a press is a **jab**: the customer flies 40% farther (+180° for 滚), the screen shakes 4 px / 80 ms with a 30 ms freeze, a synthesized slam and a small S4 caption of the key's word; the first two jabs after a correct answer add +1 each and +2 fury; no clerk voice, the line is never cut. The first press after that is **"下一位。"** (the `SYSTEM.next` clip of "（不抬头）下一位。") and the next customer arrives at once (they may start talking on its tail). A press up to 150 ms before the next customer is answerable is kept and answers then.
- **Speed multiplier** on correct answers: a cut-in (the customer is talking, from the moment the sign is up) ×2, < 600 ms after t0 ×1.5, < 1200 ms ×1.2, else ×1, applied to 1 + combo bonus and rounded up. The sign corner shows it (×2 while they talk, then ×1.5 / ×1.2 as the timer shrinks). A press before the sign is up is a guess: ×1, no big-order bonus. Combo bonus ⌊min(combo, 50) / 5⌋; charge +1 / +2 (from day 4, which introduces it) and big orders (100 cups +1, 251 +2, 520 +5, 250 +25) are flat; big orders land big.
- **Wrong key ("偏")**: +1, the combo is frozen (no reset, no increment), no fury; the customer still flies the pressed key's way on the punch, and the right key flashes after the line (the next sign waits for it).
- **Rage ("人潮冲柜台")**: fury is earned by skill (cut-in +14, perfect +10, correct +6, paid jab +2; arrivals +0; day 3 doubles gains in its first 30 s). A full bar glows (keys pulse, the clerk shivers) and the player's next press starts rage; a waiting customer steps aside and comes back after it. 6 s: a silent half-head with a sign pops every 300 ms; any key sends the current one flying the pressed key's way (+1), the matching key +2 with a heavier hit; one hit per head. The chant follows the pressed key (`rageLines` grouped 滚 / 闭嘴 / 收 in `main.js`). The rage combo is separate from the normal combo. End: 0.5 s of silence, then "（叹气）……下一位。" in the polite style.
- **Too slow**: the first timeout is free, then swagger −15 (start 70, correct +2, perfect +4). Swagger 0 = 10 s of forced politeness (every reply is a service line, queue gains ×0.5, rounded up), then swagger 40 and play goes on.
- **Charge never cuts the punch**: the old random shout at charge level 2 is gone; the customer's own line plays in full (fx 'mega').

Gameplay v2 stage 2 ([`docs/gameplay-v2.md`](../docs/gameplay-v2.md) 5–6 and 8.2; numbers there), days 2+:

- **Preview**: the next two customers' mini signs sit at the right end of the counter (`state.upcoming`).
- **Fast mouth (快嘴)**: five correct answers in a row. Ordinary customers are then silent (sign only; head 180 ms, the sign 40 ms later, t0 = sign up + 120 ms, so a press in those 120 ms is a cut-in), the clerk plays only the punch half (`audio.playClerk(…, { punchOnly })`; lines without `|` play the key's shout 滚！/闭嘴！/收！, which have clips), landing 250 ms, and the next head may pop 300 ms after the press while the last one still flies. Every 5th of them gets the clerk's full line; 250s and 251 / 520 orders are silent but full with their big landing; the specials (original, change-order, boss) keep their voices. No badge: a whoosh on entry, the combo cup stack on the counter steams and faint speed lines run along the screen edges (`ui.setCombo(n, quick)`); a wrong key or a timeout ends it (no penalty).
- **Day 3 原片日**: the original customer at 12 / 27 / 42 / 57 / 70 s (deferred while rage is ahead, so 4–5 make it).
- **Day 4 250 凑单日**: a lemon ticket "已收 N/250杯". Every 收 adds that order's cups (correct or off-key; no cups = 1); a full charge doubles them. Exactly 250: the gold-stamp scene (ticket No.250, 花字 250, a `SYSTEM.meter.hit` line), +25 and a full fury bar. Over: "两个月……喔，半年。" (`meter.over`), reset, +5.
- **Day 5 回嘴日**: the ex-boss calls (event `phone`): two presses hang up, fury +20 (+2 queue); hung up within 1.2 s (before he finishes) is the ★3 riddle.
- **Day 6 晚八点人潮**: group boxes (3–5 silent heads with the same sign colour and one big "×N" sign; each press of that key sends one flying, the last one all of them: ⌈n × (1 + combo bonus) × speed × 1.5⌉, combo +n; a wrong key scatters the group as a wrong answer) and change-order customers (a red sign "绿茶……红茶……" that flips to a gold 250杯 while they talk: 滚 before the flip is right but plain, 收 after it is right with the 250 bonus).
- **Day 7 Boss 前主管**: eight steps on one customer: 点单 (收) → 调甜 (闭嘴) → 统编 (滚) → 400 → 300 → 251 → 250 (收, a fast phrase of number signs) → "你还记得我吗？" (收 held ≥ 800 ms: "记得。你是二百五号。两个月后来拿。下一位！"). Any key moves him on (the off key with its own line, +1); a timeout makes him ask again (never an early close, no swagger cost); on the last step a tap or another key also makes him ask again. ★1 = beat him, ★2 = with no timeouts, ★3 = every haggling number within 600 ms.
- **Mini events** (`src/events.js`, one per day, starts when the counter is empty): day 2 / 6 大声公路过 (5 s, any key +1, cap 20), day 3 / 7 盖章连打 (8 s of 收: 10 stamps a press, 240 → 249 → 250; +1 a press up to 20, +25 when done), day 4 计算机老虎机 (hold 收, the display cycles 0 / 249 / 250 / 251 / 300, release on 250 = +25, else +2 with that number's line, three tries), day 5 前主管来电. A panel shows the title, the count and the hint.
- **拉铁门** (last 5 s): the customer at the counter leaves, rage ends, the shutter rolls down; any key +1, up to min(300, 10% of the queue).
- **Stars / rating**: `days.js` `evaluateDay(n, summary)` from the engine summary (which carries the rule stats: `quickBest`, `quickCutIns`, `originals`, `originalsFast`, `meterHits`, `meter249plus1`, `groupsCleared`, `bossBeaten`, `bossTimeouts`, `bossHagglePerfect`, `cutInHesitant`, `charged1cupGun`, `phoneFast`, …).

## Test

```bash
cd game
node --test test/*.test.mjs        # 229 tests: engine 78, audio 29, stage2 17, art 16, opening 16, gesture 13, huazi 14, voice 12, days 9, integration 9, events 8, ui 8
node tools/check-content.mjs       # 25 content / design-rule checks (V2 needs a rebuilt voice pack after line changes; B5 = stage 2 lines;
                                   # T1 = no Simplified character in src/*.js, index.html, style.css or content)
```

`node --test test/` with a bare directory fails on Node 22, so use the glob above.

Browser checks use Playwright (found by `tools/pw.mjs`) with the preinstalled Chromium. Serve `game/` first and pass the base URL (default `http://127.0.0.1:8765`):

```bash
node tools/play-integrate.mjs [url] [--lang=en]
    # start → opening (each wait point answered after 800 ms) → day 1 → closing card → day 2 (25 s) →
    # report → next round (day 3 on ★1, else day 2 again); a tap on the closing card in its first 1000 ms must not
    # skip it. Fails on any console/page error, an engine
    # leaving 'idle' or a sign timer during the opening, overflow, or a wrong day after the report.
    # Screenshots: tools/shots/integrate-<lang>-*.png
node tools/qa.mjs [url] [--only=correct|mash|timeout] [--vp=360x640]
    # spec 1.2: A1–A3, A6–A11 at 360x640 and 390x844 (all correct), A4 (random key every 300 ms),
    # A5 (every wait point timed out). Screenshots: tools/shots/qa-*.png
node tools/check-opening.mjs [url] [--vp=360x640] [--only=play|skip|perf] [--no-perf] [--cpu=4]
    # the opening with one wrong press at W1 and a double wrong press at W3 (auto-advance), the skip run
    # for a returning player, and a 4x-CPU run at 360x640 (A13). Checks A1–A4, A8–A13 and the hint rules.
    # Screenshots: tools/shots/opening-<viewport>-<beat>.png
node tools/check-signature.mjs [url]
    # the "250" signature: the opening's 250 customer (S2 250, 调你妈, 黄金比例, ticket No.001 / 250杯 /
    # 两个月后取餐, +10), a 250-cup customer in free play (+bonus250, no long scene), and the two-step
    # original customer on day 3 (收 → purple sign → 闭嘴 → 调你妈).
node tools/measure-pace.mjs [url] [--reaction=700] [--from=t0|sign] [--seeds=1,2,3] [--lang=zh] [--min=N]
    # day 1 pace with real voice clip lengths: plays day 1 free play (?skipOpening=1&seed=N) answering every
    # customer with the right key a fixed reaction after the window opens (t0) or after the sign is up (sign: a
    # press while the customer talks is a cut-in) and prints customers served per 45 s and the split of one
    # customer. --min=N exits 1 below that mean.
node tools/bots.mjs [url] [--profiles=expert,normal,sloppy,masher] [--days=1,…,7] [--seeds=1,2,3] [--par=7] [--out=f.jsonl]
    # four scripted players play whole days in real time (gameplay-v2 acceptance): expert (cut-in + 900 ms hold,
    # jabs, next), normal (700 ms after t0, two jabs, next), sloppy (300–2700 ms, 25% wrong), masher (a random key
    # every 300 ms). One JSON line per run (queue, ★1 pass, served per 90 s, dead presses, feedback presses per 10 s,
    # rage share, timeouts, early close), then a summary per profile × day, the expert / normal ratio and the masher
    # vs ★1. --par pages run at once (7 is fine on 4 cores; the full 84 runs take about 20 minutes).
node tools/shot-stage2.mjs [url] [--days=2,3,4,5,6,7] [--lang=zh]
    # stage 2 screens with an in-page player (right key 700 ms after t0, holds on the boss's last step, mashes
    # events): start card, round banner, fast mouth + preview, meter, each mini event, group box, change-order flip,
    # boss (haggling and the hold step), shutter, summary. tools/shots/s2-*.png; warns when a panel leaves the stage.
node tools/check-gesture.mjs [url] [--out=dir]
    # gesture mode with real pointer gestures (page.mouse): the opening answered by gesture (plus one stray tap that
    # must answer nothing), day 1 free play (each sign answered with its gesture, some fast up-right flings), then day 3
    # until rage, where long swipes cross the row of heads. Reports answers per gesture kind, multi-head rage swipes,
    # bowling / STRIKE, the hidden pad and errors. Screenshots gesture-fling / -slap / -stamp-hold / -rage-swipe.png
node tools/check-voice.mjs [url] [--out=dir]
    # voice mode with a fake microphone: Chromium gets --use-fake-ui-for-media-stream --use-fake-device-for-media-stream
    # --use-file-for-fake-audio-capture=<wav> with a voice loop synthesized by tools/voice-wav.mjs (1 s room noise, 0.5 s
    # soft setup, 0.2 s pause, 0.5 s loud shout, 1 s room, 1.2 s long shout, 0.8 s room). Start card → mic card → the
    # opening by shouting → day 1 (30 s) by voice → day 3 until rage (swept by sustained shouting) → summary. Checks the
    # mic, opening, voice answers, karaoke (plain, in the subtitle slot, setup smaller than the punch), hidden pad, rage
    # sweeps, 反差 bonus, self-replay, a meter without words, the kill list, the loudest-shout row and errors. Screenshots voice-prompt / -karaoke / -karaoke-lit / -meter / -contrast / -rage / -summary.png
node tools/check-killlist.mjs [url] [--days=2,3] [--no-opening] [--strict]
    # docs/art-direction-v2.md 9 "show, don't tell": the opening + day 1 by keys, days 2 and 3 with an in-page player,
    # sampled every 100 ms (tools/killlist.mjs): no mechanic word (反差, 快嘴, ×2, 全倒, STRIKE, 爆氣, 小聲客氣 …) in the
    # FX layers, at most one 花字 on screen and only the allowed ones, no stage directions in subtitles, the punch popping
    # on the beat, the cup stack in fast mouth, the red edge vignette in rage; then the old caption APIs called directly.
    # Kill words in the UI chrome (HUD, cards, day banner, preview, event panel) are WARN lines (fatal with --strict).
node tools/check-hant.mjs [url] [--out=dir]
    # no Simplified Chinese on screen: a zh-CN browser (must still get Traditional) through the opening and day 1, then
    # days 3–7 (30 s rounds; day 5 with the button pad). Records every text node / attribute / title the page shows and
    # fails on any character of tools/hans-chars.mjs. Screenshots tools/shots/hant-*.png
node tools/shot-ui.mjs [url]       # legacy ui-demo.html states (fake data) + overflow checks
```

Stop the server with `pkill -f "m http.server 876[5]"`.

Demo pages: `art-demo.html` (every clerk mood, customer, sign and monitor scene), `audio-demo.html` (every sound and voice style), `ui-demo.html` (older fake-data UI states).

## Layout

```
game/
  index.html            entry page (fonts, empty #app, src/main.js)
  style.css             all styling: palette (2.2), 9:16 stage, camera, clerk moods, customer, signs, 花字 layer,
                        keys, HUD, cards; sizes in cqw (1cqw = 1% stage width)
  src/
    main.js             integration: start card → opening → days, engine events → ui / audio, main loop
    engine.js           pure game logic (no DOM), deterministic with injected rng
    days.js             days 1–7 tuning, pools, unlock order, daily rules, star conditions, evaluateDay (pure)
    events.js           mini events: megaphone, phone, calculator, stamp, shutter (pure state machines)
    gesture.js          gesture mode: stroke classifier + streaming recognizer (swipe / taps / hold / tap; pure)
    voice.js            voice mode (吼骂模式): loudness analysis, noise floor, shout detector, contrast, keywords (pure)
    mic.js              voice mode microphone: getUserMedia → AnalyserNode frames + 3 s in-memory ring buffer (local only)
    opening.js          day 1 opening script director (beat list, injected clock)
    art.js              SVG / HTML string templates for all art (pure)
    huazi.js            花字 allow list, picking, repeat limit, subtitle setup / punch split (pure)
    ui.js               DOM, input, camera, 花字 rendering, guidance, cards
    audio.js            WebAudio SFX synth, bed, voice pack playback with "|" cut points, voice punch chain, Web Speech, bleep
    content.js          getContent(lang) → { customers, system }, merges en over zh by id
    content.zh.js       100 customers + SYSTEM_ZH in Taiwan Traditional (incl. opening, originalCustomer, tips, unlock, start; stage 2: days,
                        report, quick, eventUi, meter, calculator, megaphone, phone, stamp, group, changeOrder, shutter, boss)
    content.en.js       100 customers + SYSTEM_EN (US English; 250 = "quarter-wit" slip)
  test/                 node:test files (see Test)
  tools/
    check-content.mjs   content and design-rule checks (B, C, H, T, V items)
    check-hant.mjs      no Simplified character on screen (zh-CN browser, opening, days 1 and 3–7)
    hans-chars.mjs      Simplified-only characters (generated from OpenCC by gen-hans-chars.py)
    play-integrate.mjs  end-to-end smoke
    qa.mjs              first-minute QA (spec 1.2)
    check-opening.mjs   opening acceptance (A1–A13, wrong press, skip, perf)
    check-signature.mjs the "250" signature checks
    check-gesture.mjs   gesture mode with real pointer gestures (opening, day 1, rage)
    check-voice.mjs     voice mode with a fake microphone (opening, day 1, rage, contrast, replay, loudest)
    check-killlist.mjs  art-direction-v2 9: no mechanic words on the play screen (killlist.mjs = the shared probe)
    voice-wav.mjs       synthesizes the fake microphone's voice loop for check-voice.mjs
    measure-pace.mjs    day 1 pace measurement (customers served per 45 s)
    bots.mjs            four scripted players, days 1–7 (balance, stars)
    shot-stage2.mjs     stage 2 screenshots
    shot-ui.mjs         ui-demo.html screenshots
    pw.mjs              Playwright locator
    voice/              offline AI voice-pack builder (export-lines.mjs, build_voice.py)
    shots/              screenshots (git-ignored)
  voice/                generated voice pack (manifest.json + mp3 sprites)
  art-demo.html, audio-demo.html, ui-demo.html
```

## Module contracts

Each module's full contract is in the comment at the top of its file. In short:

- **engine** `createGame({ customers, rng, config })` → `{ start, tick, press, release, aim, unaim, jab, summon, charge, speechDone, flip, delayNext, pause, resume, bonus, on, off, state, config, patienceFor, speedMultFor }`. Stage 2 config (all off by default): `preview`, `quickAt` / `quickEvery` / `quick*Ms`, `specials` (`[{ customer | type: 'group', atMs }]`), `groupMult`, `flipSpeakMs`, `meter`, `events`, `shutterMs`; events `quickStart`, `quickEnd {run}`, `groupHit`, `flip`, `holding`, `bossAgain`, `meter {value, add, hit, over, queueDelta}`, `leave`, `eventStart` / `eventCue` / `eventEnd`; `state.upcoming`, `quick`, `quickRun`, `meter`, `event`, `shutter`, `st2` (rule stats, also in the `over` summary); `current.key` is the key the sign wants now. `special` (the two-step original customer) never arrives in rage or while the fury bar is full; it comes right after rage instead. Events: `start`, `arrive`, `ready {customer, patienceMs, step}` (t0: the window starts), `step` (first step of a two-step customer), `resolve {…, cutIn, early, land, step, mult, forced, big}`, `polite`, `charge`, `bonus`, `jab {key, n, queueDelta}`, `summon`, `furyFull`, `rageStart {requeued}`, `rageHead {customer, n}`, `rageHit {queueDelta, key, match, n}`, `rageMiss`, `rageEnd {hits, queueDelta}`, `forcedStart`, `forcedEnd`, `milestone`, `over`. `press()` returns the answer, `{ buffered }`, `{ rageStart }`, a rage hit / miss, or null (main.js turns a null press in a landing pause into `jab()` / `summon()`). While `current.speaking` patience does not run; a press then is a cut-in (reaction 0) from `cutInFromMs`, earlier an early press. Landing pauses: `landMs` / `landBigMs` (curse, 250, big orders, charge 2) / `landWrongMs` / `landPoliteMs`; `delayNext(ms)` lengthens one. `auraWrong: 0`: a wrong key never costs swagger; swagger 0 starts forced politeness (`state.forced`), never `over`. Gesture mode: `aim(key)` freezes the timer of the customer at the counter while a stamp is held (`current.aiming`; the next answer is timed from it), `unaim()` drops it; `rageLiveMs` (0 by default) keeps unhit rage heads hittable that long (`state.rageLive`), and `press(key, holdMs, { head })` hits a given one (`rageHit.head`).
- **days** `DAYS`, `dayInfo(n)`, `configForDay(n, extra)`, `poolForDay(n, customers)`, `clampDay(n)`, `specialsForDay(n, { original, change, boss })`, `meets(cond, summary)`, `evaluateDay(n, summary)` → `{ stars, count, rating, gold, mask }`.
- **events** `createEvent(type, { queue, config })` → `{ tick, press, release, state, done }` returning effects (`queue` / `fury` / `cue` / `end`), `dueEvent(list, clock, opts)`, `calcValue(holdMs)`, `shutterCap(queue)`, `EVENTS`.
- **opening** `runOpening({ ui, audio, content, lang, onDone, now, schedule, cancel, storage, skippable })` → `{ press(key), skip(), stop(), active, waiting, beat, elapsed }`. Beat times may also be `['max', a, b]` and `['beat', id, ms]`; "调你妈！" holds `CLIMAX_HZ_MS` (1400 ms) before "黄金比例最好喝！". A first wrong press plays its quip with the keys live: after `quipCutMs` (250 ms) the right key cuts it and answers, a wrong one gives "算了，我自己来。" at once. Later timeouts rotate `timeout.notMeAlt`. `content` / `lang` may be getters (a language switch applies from the next line). `onDone({ skipped, queue: 12 })` at F4. It never touches the engine.
- **art** `CLERK_SVG`, `SHOP_SVG`, `COUNTER_SVG`, `customerSVG()`, `signSVG()`, `signText()`, `miniSign()`, `KEY_ICONS`, `GESTURE_ICONS`, `FINGER_SVG`, `DOOR_GATE_SVG`, `STAR_SVG`, `ticketHTML()`, `monitorHTML()`, `queueCapText()`, `queueCrowd()`; the CSS hooks (classes / data attributes) are listed in its header.
- **voice** (pure) `levelFrom(samples)` → dBFS, `loudness(db, floor, tuning)` → -1 / 0 说 / 1 骂 / 2 吼, `tuningFor({ whisper })`, `createCalibrator()`, `createShoutDetector({ floor, whisper })` → `feed(db, t)` → events `onset` / `rise` / `sustain` / `peak` (with `softMs`, `softDb`, `contrast`) / `end` (duration, peak), `resetPhrase()`, `mute()`; `contrast(quietDb, loudDb)`, `contrastBonus`, `splText(dbfs)`, `keywordKey(text)`. **mic** `createMic({ getContext, onFrame })` → `{ start() → { ok, reason }, stop(), clip(fromMs, toMs) → AudioBuffer }` (getUserMedia → AnalyserNode frames + a 3 s ring buffer; local only).
- **gesture** `classify(samples | strokes)` → `{ kind: 'swipe'|'taps'|'hold'|'tap'|'none', dir, angle, speed, dist, holdMs, taps }`, `keyOf`, `swipeCharge`, `holdCharge`, `tapCharge`, `towardQueue`, `bowlCount`, `GESTURE` (thresholds), `createRecognizer({ onGesture })` → `{ down, move, up, cancel, tick, reset, active }` emitting `swipe` / `swipeMove` / `swipeEnd` / `tap {n}` / `burstEnd` / `holdStart` / `holdLevel` / `holdEnd`.
- **huazi** (docs/art-direction-v2.md 8.3) `pickHuazi(line, ctx)` → at most one item, only X你媽 / 250 · 二百五 · 251 · 520 / 黃金比例最好喝, 滾 · 閉嘴 · 收 only with `ctx.big`, 兩個月後 as S5 in the opening (everything else is subtitle emphasis; no S3), `createHuaziTracker({ mode, lang })` (no keyword twice within 5), `isAllowedHuazi(item)`, `s4Symbol(text)` (S4 = symbols only), `subtitleParts(line)` (the subtitle's setup / punch), `HZ_GAP_MS` = 900.
- **ui** `createUI(root, { onPress, onCharge, onRelease, onGesture, onStart, onToggleLang, onToggleBleep, onToggleInput, onVoiceOption })`: voice mode `setVoiceOptions`, `voicePrompt(texts) → Promise<boolean>`, `karaoke({ setup, punch, key })`, `karaokeProgress({ setup, punch })`, `voiceMeter`, `voiceLevel`, `voicePunch`, `voiceStatus('calib'|'replay'|'')`, `voiceToast` (no-op), `loudest` on the summary / closing card; gesture mode `setInputMode`, `setGestureHints`, `slap`, `stampHold`, `stampSlam`, `setFling`, `bowl`, `rageHeadAdd` / `rageHeadHit` / `clearRageHeads`, `gestureHint`; stage 2 `setPreview`, `setMeter`, `setCombo(n, quick)` (cup stack; `setQuick` / `setSignMult` are no-ops), `showGroup` / `groupHit`, `showEvent` / `updateEvent` / `hideEvent`, `shutter`, `dayBanner`, and day lines on `showStart` / stars on `showSummary`; HUD (`render`, `setHud`, `setQueue`, `setTicket`, `setTexts` (also relabels the scene props), `setScript('hans'|'hant')`, `queueGain(n)`), clerk (`setClerk`, `setClerkFlags`, `clerkBeat`, `clerkTap`, `resetClerk`), customer and sign (`showCustomer`, `showSign`, `signExit`, `signFx`, `startSignTimer`, `customerReact`, `customerPose`, `showPlate`), camera and fx (`camera`, `flash(ms)`, `speedLines(ms)`, `shake(px, ms, dir)` (directional), `punchFx(level, key)` (small / medium / big, art-direction-v2 8.1), `freeze` (hit-stop: 花字 and subtitles keep playing), `letterbox`, `gate`, `goldsign`), 花字 (`huazi(list, timing)`, `clearHuazi({ pendingOnly })`), subtitles (`showLine`, `emphasize`), guidance (`guide`, `clearGuide`, `hintCorrect`, `tip`, `breathKey`, `coverKey`, `lockInput`, `unlockInput`, `inputLocked`), screens (`showStart`, `fontsReady`, `showClosing`, `showRecap`, `showSkip`, `showSummary`, `showMilestone`). Pure exports for tests: `createFxQueue`, `chargeLevel`, `FOCUS`, `camTransform`, `rectsOverlap`, `placeHuazi`, `hzFontSize`, `hzMaxScale`.
- **audio** `createAudio()`: `unlock`, `context` (the shared AudioContext), `playUserClip(buffer, { gainDb = 6, rate = 1.06 })` (voice mode: the player's shout through the megaphone punch chain), `setLang`, `setBleep`, `loadVoicePack`, `playClerk(text, { punchGapMs, punchFx, bedBackMs, style, punchOnly })` (returns a Promise carrying `{ setupMs, punchStartMs, punchMs, totalMs }`), `playCustomer(text, { rate })` (`{ ms }`), `voiceTimings`, `cut`, `hush`, `duck` / `restore`, `bed`, `loop` / `stopLoop(s)`, `sfx(name, opts)`, `crowd`, `speak`, `stopSpeech`, `announce`, `setVoiceFx(on | tuning)` / `voiceFx`, `setLite(on)`; `createAudio({ voiceFx })`.
- **voice punch** (`VOICE_FX`, `voicePlan()` in `src/audio.js`; Kokoro has no emotion, so the hit is made in the mix). The hit of a clerk line (the half after `|`; the curse half when the curse comes first, as in "调你妈！\|黄金比例最好喝！"), rage lines and the 调你妈 climax play through WaveShaper saturation (gentle; curse / mega / rage use the spec's k = 8 curve) → +5 dB (+6 hot) → DynamicsCompressor (1 ms attack) → +3 dB makeup, at playbackRate 1.06 (mega keeps 0.94), with a synthesized impact (120→45 Hz thump + 2.2 kHz noise slap) at the exact onset; rage adds a subtle megaphone band (600 Hz–3.2 kHz, 1.8 kHz bump), mega keeps the 70 ms / 25 % echo. The polite setup half plays clean and 1.5 dB softer; a hit without a setup waits 60 ms (breath). The forced-polite voice is never punched. All reported durations (`playClerk`, `voiceTimings`) include these rates and the breath, so `main.js` / `opening.js` timing stays exact. Lite mode drops the compressor, shaper and megaphone (timing unchanged); `main.js` syncs it from `ui.lite` every frame. Measured in headless Chromium on r1 / r2: setup → punch contrast 7.5 dB (was 3.7), punch peaks 0.85–0.88 (the old +4 dB chain hit 1.0).
- **content** 100 customers `{ id, cat, name, tag, cups, says, reply, alt, style, key }` per language; `reply` / `alt` of the day 1 pool carry one `|` cut point (setup | punch). Text inside `（…）` / `(…)` is a stage direction: shown small, never spoken.

### main.js integration rules

- The engine always runs on the Chinese customer list (`id`, `style`, `key`, `cups` match in both languages); every shown or spoken line is looked up by id in the current language.
- Each day builds a fresh engine from `configForDay(day)` / `poolForDay(day)`. During the opening the day 1 engine exists but is never started (A2); afterwards a new one starts with `bonus(12)` (the opening's line, no milestone popup).
- Input goes to `opening.press` while the script runs, otherwise to `game.press` after the engine clock is advanced to the press time (landing pauses are measured from the real press).
- The sign leaves on the press (5.2) and the customer flies on the punch, the pressed key's way, for a correct and a wrong key alike (v2); on a wrong one the right key flashes after the line (4.4 hint), and the next sign waits until the flash is over. A new sign removes any 花字 still showing where it rises, and an S1 slam never starts larger than the room it has next to a sign.
- A press with nobody at the counter: a jab (`game.jab`) until the punch end + 200 ms (after a timeout or rage: nothing until the line ends), then "下一位。" and `game.summon()`. Forced politeness: the reply is a `SYSTEM.polite` line in the polite style, no 花字.
- `game.delayNext(max(punch end + L − signUp, fly-out end, setup end + 80, 花字 end − signUp, subtitle reading time − signUp))` keeps the next customer from stepping on the laugh while the entrance overlaps the tail of the landing (pace: the next sign is up and the customer talks when L ends; the engine still waits at least its own L after the press). The engine keeps a longer pause asked for inside the `resolve` / `polite` handlers (it used to reset it to L right after them, so 花字 landed on the next sign).
- Clerk subtitles drop stage directions (the face and 花字 act them out); customers show their own line when they start talking (`showCustomer(…, { line: false })`).
- The day 1 draw does not repeat a customer while that key still has unseen ones, and "今天第一个" (#46) is only used for the round's first booked order.

## Known limitations

- **Voice mode** (吼骂模式) was only tested with Chromium's fake microphone (a synthesized loop): the thresholds (+12 / +22 / +30 dB over the floor) need real phones and rooms; microphones differ a lot. iOS Safari needs 14.3+ for `getUserMedia`, switches the audio session to play-and-record once the mic is open (quieter speaker, sometimes the earpiece, call-quality Bluetooth) and stops the mic in the background (pick 吼 again on the start card). `ScriptProcessorNode` (the replay ring buffer) is deprecated but still everywhere; replace it with an AudioWorklet later. Devices with weak echo cancellation may hear the customers' voices as the player's soft setup; headphones help. Without keywords only loudness counts (shouting "啊——" works, on purpose). Voice answers are always charge ≥ 1, so scores run a bit above gesture play; the bots do not cover voice mode.

- **Gesture mode** (default). Tested with Playwright's mouse (pointer events) in headless Chromium, not yet on a real phone: the thresholds (40 px, 180 ms, 0.8 / 1.5 px/ms) need a thumb test, and a real thumb flick is often faster than the mouse runs. Three taps take about 0.4–0.6 s, so 闭嘴 answers come a little later than a key press (speed multiplier); a stamp freezes the timer, so 收 does not lose time. The fling physics, bowling and slap pops are plain CSS / rAF (no lite-mode variant beyond skipping the hit-stop). `tools/bots.mjs`, `measure-pace.mjs` and the other key-driven checks run in the default (gesture) mode through J / K / L; with `rageLiveMs` the keyboard in gesture mode may also hit an older unhit rage head, so the 8.1 / 8.2 bot numbers were measured in button mode (`?input=buttons` keeps that engine config exactly).

- **Voice pack.** Lines changed for the first-minute redesign (the opening, the `|` halves of the day 1 pool, number readings) need a full rebuild (`tools/voice/README.md`, not `--incremental`); until then `check-content.mjs` V2 fails and those lines use Web Speech with estimated timings. After the rebuild, listen to the opening once (K1: "250" must be read as 二百五十).
- **Performance on low-end devices (A13).** Camera glides on the SVG scene were most of the cost (about 16% long frames at 4x CPU in headless Chromium). A K4 lite mode switches itself on when a 30-frame window has 6+ frames over 32 ms (camera cuts instead of glides, no idle loops, no spinning rays). The next biggest cost was SVG text layout: every camera zoom re-laid out each `<text>` in the scene (Blink re-scales SVG glyphs to the screen) and every 花字 frame re-laid out its caption, so scene and 花字 text use `text-rendering: geometricPrecision`; fixed-size layers whose content changes (caption, subtitle, customer, fx, keys) have `contain: size layout style`; the door monitor draws its crowd as grouped paths (no `<use>` per person) and is rebuilt only when its drawing changes; `--cam-ms` / `--cam-ease` are registered non-inherited. The 4x-CPU opening now measures 2.8–3.7% long frames (was 4.4–6.5% on the same machine, interleaved runs), still worth a real-phone check. Headless runs that take many screenshots can trip lite mode; add `?lite=0` for visual QA (`?lite=1` forces it).
- **Around the stage.** On screens wider than 5:8 (desktop, tablets, embedded viewers) `.app` paints a static shop-front backdrop around the 9:16 stage (awning, string lights, facade tiles, the queue continuing out of frame, a vignette; data-URI SVG tiles and gradients, no animation) and the stage gets a wooden door frame; from 1:1 two vertical shop signs ("250杯" / "珍珠奶茶", English "250" / "TEA") hang in the gutters. Their text is CSS `content`, so it is not run through `hant.js` (both signs use characters that are the same in Traditional). Phones in portrait keep plain ink bars.
- **Google Fonts** may be blocked (the sandbox proxy here); the game falls back to system fonts.
- **Voice punch is a mix-stage stand-in.** It adds level, density and an impact but cannot add real anger to Kokoro's flat read. A rebuild with `export-lines.mjs --punchy` (tools/voice/README.md) can also bake faster, limited punch halves into the pack; then consider lowering `VOICE_FX.punchRate`. A recorded voice actor (docs/voice) remains the real fix.
- **Chinese is Traditional (Taiwan) at the source**: `content.zh.js` and every Chinese string in `src/`, `index.html` and the art are written in Taiwan Traditional (converted once with OpenCC s2twp plus the Taiwan wording table, reviewed by hand; writing guide in [`docs/localization-tw.md`](../docs/localization-tw.md)). `check-content` T1 and `tools/check-hant.mjs` fail on any Simplified-only character (`tools/hans-chars.mjs`, regenerate with `python3 tools/gen-hans-chars.py > tools/hans-chars.mjs`). zh-HK / zh-MO get the same Taiwan text. The voice pack is still Kokoro's mainland-accented Mandarin: the builder converts the text to Simplified (OpenCC t2s) only for the G2P, so a Taiwan accent needs a different voice or a recorded actor (the doc lists the readings that differ).
- **Gameplay v2 stage 1 limits** (bot numbers before / after: [`docs/gameplay-v2.md`](../docs/gameplay-v2.md) 8.1; dead input 60–78% → 1–7%, rage share 64–83% → 16–28%, masher ★1 15/15 → 0/15, no early closes). The expert / normal ratio is 1.6–2.4 (target 1.5–2): the expert bot cuts in and charges every customer. Customers served per 90 s stay about 16–17 for a player who waits for t0 (24 for one who cuts in); the clerk's full line (about 2 s) and the customer's (about 1.5 s) still play for everyone, so the plan's 35 needs stage 2 (快嘴: punch only). The rage chant uses the existing short shouts grouped by key; it does not yet name the customers met today (needs new lines). The jab's S4 caption sits at the S4 slot (inner-voice bubble), not at a random spot.
- **Gameplay v2 stage 2 limits** (bot numbers: [`docs/gameplay-v2.md`](../docs/gameplay-v2.md) 8.2). The stage 2 lines (boss, meter, calculator, megaphone, phone, stamp, group, change-order, shutter) have no voice clips yet: they play through Web Speech with estimated timing and `check-content.mjs` V2 fails until the pack is rebuilt (`tools/voice/README.md`; the export already lists them). A normal player (bot: 700 ms after t0) serves about 22 customers per 90 s on days 2–7 (30 on day 2, 31 on day 6; 1.5 s per customer while fast mouth runs), short of the plan's 35: the five full-pace customers before fast mouth, the mini event, the shutter, rage and the day's own scenes (5 original customers on day 3, the 8-step boss on day 7) take the rest. The expert / normal ratio is 1.6–2.1 except day 2 (2.7: the expert cuts in on every silent customer). Fast mouth's cut-in window is 120 ms (sign up → t0); day 4's ★2 (exactly 250) is luck for a player who never books off-key.
- **Day 1 pace** (`tools/measure-pace.mjs`, real clip lengths, 700 ms reaction, seeds 1–4): about 12 customers in 45 s for a player who answers 700 ms after the sign is up (cut-ins included; was 10.5), about 10 for one who waits until the customer has finished (700 ms after t0; was 8.5). English: 11.5 / 9. The spec's 13 is out of reach without cutting voice: the day 1 clerk lines average about 2.3 s and the customer lines about 1 s, and neither is sped up or cut; the remaining slack is L (650 / 1100 ms, the spec's landing).
- **The tab must be visible.** `dt` is capped at 100 ms per frame, so a backgrounded tab effectively pauses the game.
- **Half-width parentheses are always stage directions**, so ordinary English parentheses in content are hidden from speech too.
- **Audio sourcing for a release build:** see [audio sourcing notes](../docs/audio-sourcing.md).
