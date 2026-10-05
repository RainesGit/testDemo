# 来250杯！ / 250 Cups!

A playable web prototype of a vertical (portrait) phone comedy game. You play a cocky bubble-tea clerk on a very high counter in a Taiwanese night-market tea stand. Customers peek up from below, hold up an order sign and say their order. Answer each one with **滚 / 闭嘴 / 收** (Scram! / Zip it! / Booked!). The sign's colour is the key's colour. The ruder you are, the longer the line gets. The only way to lose is being too slow: then the clerk is forced into a sugary service voice and the shop boos.

The first minute follows [`docs/first-minute-spec.md`](../docs/first-minute-spec.md) (art, the day 1 opening script, pace, 花字 captions, days 1–7). Where it conflicts with `docs/game-design.md`, the spec wins. Gameplay rules follow [`docs/gameplay-v2.md`](../docs/gameplay-v2.md) where it says so; stage 1 ("手感地基": jab + next, speed multiplier, frozen combo on a wrong key, the rage rework, forced politeness instead of an early close) is in; stages 2–3 are not.

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
| `?lang=zh` / `?lang=en` | Starting language. Otherwise the saved choice, then `navigator.language`. |
| `?lang=zh-TW` / `zh-HK` / `zh-Hant` | Chinese in Traditional characters (also the default for a zh-TW / zh-HK / zh-MO browser); `?lang=zh-CN` / `zh-SG` forces Simplified. Display only (`src/hant.js`). |
| `?bleep=1` | Starts with bleep mode on (调你妈 → 调你哔). |
| `?day=N` | Start on day N (1–7) instead of the saved day. |
| `?skipOpening=1` | Day 1 starts free play directly (QA). |
| `?debug&first=78,63,47` | The listed customer ids come first in every round (QA: a deterministic draw). |
| `?seed=N` | Seeded randomness (QA). |
| `?lite=1` / `?lite=0` | Force the K4 lite mode (camera cuts, no idle loops) on or off; otherwise it switches on by itself on slow devices. |
| `?punchfx=0` | Turn the runtime voice punch off (plain spec 8.5 punch chain) for A/B listening; on by default. |
| `?debug` | Exposes `window.__250` for automated tests: getters `game`, `opening`, `day`, `info`, `lang`, `inputs` (press outcomes this round: `answer` / `wrong` / `step` / `buffered` / `jab` / `next` / `rageStart` / `rage` / `rageMiss` / `dead`), plus `audio`, `ui`, `getContent`, `DAYS`, `startDay(n)` and a `durationMs` setter that shortens the next rounds. |

Saved in `localStorage` (every access is wrapped in try/catch): `250cups.day` (only goes up), `250cups.openingDone`, `250cups.lang`, `250cups.bleep`.

## The flow

1. **Start card** (3.2): the title slams down, the tagline fades in, from 1200 ms the big button "点一下 开店" (later "开店（第 N 天）") breathes; a tap before that starts the shop too. That tap also unlocks audio; the game waits at most 300 ms for the fonts.
2. **Day 1 opening script** (section 3, `src/opening.js`, about 33 s): the shutter rolls up, "你要几杯？", customer 1 "嗯……" (teaches 滚), customer 2 "15杯！" (滚 again), customer 3 "250杯！" (teaches 收: "好，250杯什么？"… "冰块甜度要不要调？" "少甜少冰！" teaches 闭嘴) → "调你妈！" → "黄金比例最好喝！" → "我们都是现点现做，250杯，两个月后过来拿。这是你的取餐号码牌。" → "下一位！", logo, a three-key recap. The engine stays `idle` the whole time; there is no timer. Each wait point escalates hints (glow → counter taps → finger and dashed line), a first wrong key gets a quip, a second wrong key makes the clerk do it himself ("算了，我自己来。"), a 5 s timeout plays the service voice once. Nothing costs points. The 12 people in line carry into day 1.
   Once the script was completed, a later day 1 (for example after quitting mid-day) replays it with "跳过 ▸" after 1200 ms, which jumps to the recap.
3. **Day 1 free play** (45 s): fixed first three customers (1 杯 → 100 杯 → 可以少冰吗？), then a weighted mix. The HUD shows only the queue (no bars, no clock, combo only from 5).
4. **Closing card** (3.8): the day's last line is read first, then the verdict, then the card: the ticket "No.001 / 250杯 / 两个月后取餐" with today's savagest line, "第一天 打烊" / "门口排了 N 人" on two lines, the three sign types with their keys, stars, and a centered button "开第二天 ▸" that works from 1000 ms on (taps elsewhere and J/K/L do nothing, so a player still mashing cannot skip it).
5. **Days 2–7** (90 s each, one new system per day, section 7): day 2 timeouts and the swagger bar, day 3 fury/rage and the two-step original-film customer, day 4 hold-to-charge, and so on. The report card shows the ★1 goal; reaching it opens the next day, otherwise the day is replayed. A day only ends by its clock: running out of swagger means 10 s of forced politeness, never an early close.

Per customer (4.1): head pops up → sign rises (signUp) → the customer talks once the clerk is quiet and the clerk's subtitle has been read → the answer window starts when they finish (t0; on day 1 `talkLeadMs` = 400 ms before the voice ends, clamped to signUp + 250…1600 ms) and shows as a bar on the sign → press → the sign leaves at once, the clerk's line plays as setup | silence | punch with the three-beat face, 花字, "+N" flying into the door monitor and the customer flying out on the punch → a silent landing L after the punch, in whose tail the next head pops and the sign rises, so the next customer talks when L ends. The sign is up only once the punch 花字 have played and the subtitle has been read (a voiced line: voice end + 300 ms, at least 1000 ms and 100 ms per character; otherwise max(1500 ms, 140 ms per character)), and the head never pops before the old customer has flown off. A new customer cancels 花字 that have not started and resets the clerk's pose; its rising sign clears any 花字 in its way.

Controls: tap the three keys, or **J / K / L**. A press resolves at once; holding on to 300 / 800 ms upgrades that same answer (charge level 1 / 2). Enter or Space taps the visible card. **中/EN** and **消音 / Bleep** work everywhere.

Gameplay v2 stage 1 ([`docs/gameplay-v2.md`](../docs/gameplay-v2.md) 3–4), on top of the flow above:

- **Every press answers.** While the answered customer flies (from the answer until the punch line ends + 200 ms) a press is a **jab**: the customer flies 40% farther (+180° for 滚), the screen shakes 4 px / 80 ms with a 30 ms freeze, a synthesized slam and a small S4 caption of the key's word; the first two jabs after a correct answer add +1 each and +2 fury; no clerk voice, the line is never cut. The first press after that is **"下一位。"** (the `SYSTEM.next` clip of "（不抬头）下一位。") and the next customer arrives at once (they may start talking on its tail). A press up to 150 ms before the next customer is answerable is kept and answers then.
- **Speed multiplier** on correct answers: a cut-in (the customer is talking, from the moment the sign is up) ×2, < 600 ms after t0 ×1.5, < 1200 ms ×1.2, else ×1, applied to 1 + combo bonus and rounded up. The sign corner shows it (×2 while they talk, then ×1.5 / ×1.2 as the timer shrinks). A press before the sign is up is a guess: ×1, no big-order bonus. Combo bonus ⌊min(combo, 50) / 5⌋; charge +1 / +2 (from day 4, which introduces it) and big orders (100 cups +1, 251 +2, 520 +5, 250 +25) are flat; big orders land big.
- **Wrong key ("偏")**: +1, the combo is frozen (no reset, no increment), no fury; the customer still flies the pressed key's way on the punch, and the right key flashes after the line (the next sign waits for it).
- **Rage ("人潮冲柜台")**: fury is earned by skill (cut-in +14, perfect +10, correct +6, paid jab +2; arrivals +0; day 3 doubles gains in its first 30 s). A full bar glows (keys pulse, the clerk shivers) and the player's next press starts rage; a waiting customer steps aside and comes back after it. 6 s: a silent half-head with a sign pops every 300 ms; any key sends the current one flying the pressed key's way (+1), the matching key +2 with a heavier hit; one hit per head. The chant follows the pressed key (`rageLines` grouped 滚 / 闭嘴 / 收 in `main.js`). The rage combo is separate from the normal combo. End: 0.5 s of silence, then "（叹气）……下一位。" in the polite style.
- **Too slow**: the first timeout is free, then swagger −15 (start 70, correct +2, perfect +4). Swagger 0 = 10 s of forced politeness (every reply is a service line, queue gains ×0.5, rounded up), then swagger 40 and play goes on.
- **Charge never cuts the punch**: the old random shout at charge level 2 is gone; the customer's own line plays in full (fx 'mega').

## Test

```bash
cd game
node --test test/*.test.mjs        # 185 tests: engine 75, audio 29, art 16, opening 16, huazi 13, hant 10, integration 9, days 9, ui 8
node tools/check-content.mjs       # 23 content / design-rule checks (V2 needs a rebuilt voice pack after line changes)
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
    days.js             days 1–7 tuning, pools, unlock order (pure)
    opening.js          day 1 opening script director (beat list, injected clock)
    art.js              SVG / HTML string templates for all art (pure)
    huazi.js            花字 picking and rate limits (pure)
    hant.js             Simplified → Traditional display conversion (OpenCC s2tw table + Taiwan wording; pure)
    ui.js               DOM, input, camera, 花字 rendering, guidance, cards
    audio.js            WebAudio SFX synth, bed, voice pack playback with "|" cut points, voice punch chain, Web Speech, bleep
    content.js          getContent(lang) → { customers, system }, merges en over zh by id
    content.zh.js       100 customers + SYSTEM_ZH (incl. opening, originalCustomer, tips, unlock, start)
    content.en.js       100 customers + SYSTEM_EN (US English; 250 = "quarter-wit" slip)
  test/                 node:test files (see Test)
  tools/
    check-content.mjs   content and design-rule checks (B, C, H, V items)
    play-integrate.mjs  end-to-end smoke
    qa.mjs              first-minute QA (spec 1.2)
    check-opening.mjs   opening acceptance (A1–A13, wrong press, skip, perf)
    check-signature.mjs the "250" signature checks
    measure-pace.mjs    day 1 pace measurement (customers served per 45 s)
    shot-ui.mjs         ui-demo.html screenshots
    pw.mjs              Playwright locator
    voice/              offline AI voice-pack builder (export-lines.mjs, build_voice.py)
    shots/              screenshots (git-ignored)
  voice/                generated voice pack (manifest.json + mp3 sprites)
  art-demo.html, audio-demo.html, ui-demo.html
```

## Module contracts

Each module's full contract is in the comment at the top of its file. In short:

- **engine** `createGame({ customers, rng, config })` → `{ start, tick, press, jab, summon, charge, speechDone, delayNext, pause, resume, bonus, on, off, state, config, patienceFor, speedMultFor }`. `special` (the two-step original customer) never arrives in rage or while the fury bar is full; it comes right after rage instead. Events: `start`, `arrive`, `ready {customer, patienceMs, step}` (t0: the window starts), `step` (first step of a two-step customer), `resolve {…, cutIn, early, land, step, mult, forced, big}`, `polite`, `charge`, `bonus`, `jab {key, n, queueDelta}`, `summon`, `furyFull`, `rageStart {requeued}`, `rageHead {customer, n}`, `rageHit {queueDelta, key, match, n}`, `rageMiss`, `rageEnd {hits, queueDelta}`, `forcedStart`, `forcedEnd`, `milestone`, `over`. `press()` returns the answer, `{ buffered }`, `{ rageStart }`, a rage hit / miss, or null (main.js turns a null press in a landing pause into `jab()` / `summon()`). While `current.speaking` patience does not run; a press then is a cut-in (reaction 0) from `cutInFromMs`, earlier an early press. Landing pauses: `landMs` / `landBigMs` (curse, 250, big orders, charge 2) / `landWrongMs` / `landPoliteMs`; `delayNext(ms)` lengthens one. `auraWrong: 0`: a wrong key never costs swagger; swagger 0 starts forced politeness (`state.forced`), never `over`.
- **days** `DAYS`, `dayInfo(n)`, `configForDay(n, extra)`, `poolForDay(n, customers)`, `clampDay(n)`.
- **opening** `runOpening({ ui, audio, content, lang, onDone, now, schedule, cancel, storage, skippable })` → `{ press(key), skip(), stop(), active, waiting, beat, elapsed }`. Beat times may also be `['max', a, b]` and `['beat', id, ms]`; "调你妈！" holds `CLIMAX_HZ_MS` (1400 ms) before "黄金比例最好喝！". A first wrong press plays its quip with the keys live: after `quipCutMs` (250 ms) the right key cuts it and answers, a wrong one gives "算了，我自己来。" at once. Later timeouts rotate `timeout.notMeAlt`. `content` / `lang` may be getters (a language switch applies from the next line). `onDone({ skipped, queue: 12 })` at F4. It never touches the engine.
- **art** `CLERK_SVG`, `SHOP_SVG`, `COUNTER_SVG`, `customerSVG()`, `signSVG()`, `signText()`, `miniSign()`, `KEY_ICONS`, `FINGER_SVG`, `DOOR_GATE_SVG`, `STAR_SVG`, `ticketHTML()`, `monitorHTML()`, `queueCapText()`, `queueCrowd()`; the CSS hooks (classes / data attributes) are listed in its header.
- **huazi** `pickHuazi(line, ctx)`, `createHuaziTracker({ mode, lang })` (one S1 per 3 customers, no keyword twice within 5).
- **hant** `toHant(text)` (idempotent), `PHRASES` (character-form fixes), `TW_PHRASES` / `TW_WHOLE` / `TW_PUNCT` (Taiwan wording, see `docs/localization-tw.md`), `HANT_CHARS`, `HANT_SAME`. Regenerate after adding text with new characters: `pip install opencc-python-reimplemented`, convert every Han character in `src/*.js` with `OpenCC('s2tw')`, keep pairs that differ, add two-character phrases where the character map disagrees with OpenCC (`test/hant.test.mjs` lists unknown characters).
- **ui** `createUI(root, { onPress, onCharge, onStart, onToggleLang, onToggleBleep })`: HUD (`render`, `setHud`, `setQueue`, `setTicket`, `setTexts` (also relabels the scene props), `setScript('hans'|'hant')`, `queueGain(n)`), clerk (`setClerk`, `setClerkFlags`, `clerkBeat`, `clerkTap`, `resetClerk`), customer and sign (`showCustomer`, `showSign`, `signExit`, `signFx`, `startSignTimer`, `customerReact`, `customerPose`, `showPlate`), camera and fx (`camera`, `flash(ms)`, `speedLines(ms)`, `shake`, `freeze` (hit-stop: 花字 keep playing), `letterbox`, `gate`, `goldsign`), 花字 (`huazi(list, timing)`, `clearHuazi({ pendingOnly })`), subtitles (`showLine`, `emphasize`), guidance (`guide`, `clearGuide`, `hintCorrect`, `tip`, `breathKey`, `coverKey`, `lockInput`, `unlockInput`, `inputLocked`), screens (`showStart`, `fontsReady`, `showClosing`, `showRecap`, `showSkip`, `showSummary`, `showMilestone`). Pure exports for tests: `createFxQueue`, `chargeLevel`, `FOCUS`, `camTransform`, `rectsOverlap`, `placeHuazi`, `hzFontSize`, `hzMaxScale`.
- **audio** `createAudio()`: `unlock`, `setLang`, `setBleep`, `loadVoicePack`, `playClerk(text, { punchGapMs, punchFx, bedBackMs, style })` (returns a Promise carrying `{ setupMs, punchStartMs, punchMs, totalMs }`), `playCustomer(text, { rate })` (`{ ms }`), `voiceTimings`, `cut`, `hush`, `duck` / `restore`, `bed`, `loop` / `stopLoop(s)`, `sfx(name, opts)`, `crowd`, `speak`, `stopSpeech`, `announce`, `setVoiceFx(on | tuning)` / `voiceFx`, `setLite(on)`; `createAudio({ voiceFx })`.
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

- **Voice pack.** Lines changed for the first-minute redesign (the opening, the `|` halves of the day 1 pool, number readings) need a full rebuild (`tools/voice/README.md`, not `--incremental`); until then `check-content.mjs` V2 fails and those lines use Web Speech with estimated timings. After the rebuild, listen to the opening once (K1: "250" must be read as 二百五十).
- **Performance on low-end devices (A13).** Camera glides on the SVG scene were most of the cost (about 16% long frames at 4x CPU in headless Chromium). A K4 lite mode switches itself on when a 30-frame window has 6+ frames over 32 ms (camera cuts instead of glides, no idle loops, no spinning rays). The next biggest cost was SVG text layout: every camera zoom re-laid out each `<text>` in the scene (Blink re-scales SVG glyphs to the screen) and every 花字 frame re-laid out its caption, so scene and 花字 text use `text-rendering: geometricPrecision`; fixed-size layers whose content changes (caption, subtitle, customer, fx, keys) have `contain: size layout style`; the door monitor draws its crowd as grouped paths (no `<use>` per person) and is rebuilt only when its drawing changes; `--cam-ms` / `--cam-ease` are registered non-inherited. The 4x-CPU opening now measures 2.8–3.7% long frames (was 4.4–6.5% on the same machine, interleaved runs), still worth a real-phone check. Headless runs that take many screenshots can trip lite mode; add `?lite=0` for visual QA (`?lite=1` forces it).
- **Around the stage.** On screens wider than 5:8 (desktop, tablets, embedded viewers) `.app` paints a static shop-front backdrop around the 9:16 stage (awning, string lights, facade tiles, the queue continuing out of frame, a vignette; data-URI SVG tiles and gradients, no animation) and the stage gets a wooden door frame; from 1:1 two vertical shop signs ("250杯" / "珍珠奶茶", English "250" / "TEA") hang in the gutters. Their text is CSS `content`, so it is not run through `hant.js` (both signs use characters that are the same in Traditional). Phones in portrait keep plain ink bars.
- **Google Fonts** may be blocked (the sandbox proxy here); the game falls back to system fonts.
- **Voice punch is a mix-stage stand-in.** It adds level, density and an impact but cannot add real anger to Kokoro's flat read. A rebuild with `export-lines.mjs --punchy` (tools/voice/README.md) can also bake faster, limited punch halves into the pack; then consider lowering `VOICE_FX.punchRate`. A recorded voice actor (docs/voice) remains the real fix.
- **Traditional Chinese is display-only**: characters are converted (OpenCC s2tw table) and the few mainland words in the text are swapped for Taiwanese ones (投诉 → 客訴, 硬币 → 銅板, 铁门 → 鐵捲門, “” → 「」 …; table and reasoning in [`docs/localization-tw.md`](../docs/localization-tw.md)). zh-HK / zh-MO get the same Taiwan wording (銅板 reads Taiwanese there; the lines themselves use Taiwan words such as 捷运 and 载具). Voice lines are still generated from the Simplified text in mainland-accented Mandarin, so the subtitle says 客訴 where #88 is heard saying 投诉; the doc lists the lines to re-word or re-record for a Taiwan voice pack.
- **Gameplay v2 stage 1 limits** (bot numbers before / after: [`docs/gameplay-v2.md`](../docs/gameplay-v2.md) 8.1; dead input 60–78% → 1–7%, rage share 64–83% → 16–28%, masher ★1 15/15 → 0/15, no early closes). The expert / normal ratio is 1.6–2.4 (target 1.5–2): the expert bot cuts in and charges every customer. Customers served per 90 s stay about 16–17 for a player who waits for t0 (24 for one who cuts in); the clerk's full line (about 2 s) and the customer's (about 1.5 s) still play for everyone, so the plan's 35 needs stage 2 (快嘴: punch only). The rage chant uses the existing short shouts grouped by key; it does not yet name the customers met today (needs new lines). `SYSTEM.unlock.aura` in content still says "气势没了＝提早打烊"; `main.js` shows "气势没了＝被迫营业" until the stage 2 content pass. The jab's S4 caption sits at the S4 slot (inner-voice bubble), not at a random spot.
- **Day 1 pace** (`tools/measure-pace.mjs`, real clip lengths, 700 ms reaction, seeds 1–4): about 12 customers in 45 s for a player who answers 700 ms after the sign is up (cut-ins included; was 10.5), about 10 for one who waits until the customer has finished (700 ms after t0; was 8.5). English: 11.5 / 9. The spec's 13 is out of reach without cutting voice: the day 1 clerk lines average about 2.3 s and the customer lines about 1 s, and neither is sped up or cut; the remaining slack is L (650 / 1100 ms, the spec's landing).
- **The tab must be visible.** `dt` is capped at 100 ms per frame, so a backgrounded tab effectively pauses the game.
- **Half-width parentheses are always stage directions**, so ordinary English parentheses in content are hidden from speech too.
- **Audio sourcing for a release build:** see [audio sourcing notes](../docs/audio-sourcing.md).
