# 来250杯！ / 250 Cups!

A playable web prototype of a vertical (portrait) phone comedy game. You play a cocky bubble-tea clerk on a very high counter in a Taiwanese night-market tea stand. Customers peek up from below, hold up an order sign and say their order. Answer each one with **滚 / 闭嘴 / 收** (Scram! / Zip it! / Booked!). The sign's colour is the key's colour. The ruder you are, the longer the line gets. The only way to lose is being too slow: then the clerk is forced into a sugary service voice and the shop boos.

The first minute follows [`docs/first-minute-spec.md`](../docs/first-minute-spec.md) (art, the day 1 opening script, pace, 花字 captions, days 1–7). Where it conflicts with `docs/game-design.md`, the spec wins.

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
| `?seed=N` | Seeded randomness (QA). |
| `?lite=1` / `?lite=0` | Force the K4 lite mode (camera cuts, no idle loops) on or off; otherwise it switches on by itself on slow devices. |
| `?punchfx=0` | Turn the runtime voice punch off (plain spec 8.5 punch chain) for A/B listening; on by default. |
| `?debug` | Exposes `window.__250` for automated tests: getters `game`, `opening`, `day`, `info`, `lang`, plus `audio`, `ui`, `getContent`, `DAYS`, `startDay(n)` and a `durationMs` setter that shortens the next rounds. |

Saved in `localStorage` (every access is wrapped in try/catch): `250cups.day` (only goes up), `250cups.openingDone`, `250cups.lang`, `250cups.bleep`.

## The flow

1. **Start card** (3.2): the title slams down, the tagline fades in, from 1200 ms the big button "点一下 开店" (later "开店（第 N 天）") breathes; a tap before that starts the shop too. That tap also unlocks audio; the game waits at most 300 ms for the fonts.
2. **Day 1 opening script** (section 3, `src/opening.js`, about 33 s): the shutter rolls up, "你要几杯？", customer 1 "嗯……" (teaches 滚), customer 2 "15杯！" (滚 again), customer 3 "250杯！" (teaches 收: "好，250杯什么？"… "冰块甜度要不要调？" "少甜少冰！" teaches 闭嘴) → "调你妈！" → "黄金比例最好喝！" → "我们都是现点现做，250杯，两个月后过来拿。这是你的取餐号码牌。" → "下一位！", logo, a three-key recap. The engine stays `idle` the whole time; there is no timer. Each wait point escalates hints (glow → counter taps → finger and dashed line), a first wrong key gets a quip, a second wrong key makes the clerk do it himself ("算了，我自己来。"), a 5 s timeout plays the service voice once. Nothing costs points. The 12 people in line carry into day 1.
   Once the script was completed, a later day 1 (for example after quitting mid-day) replays it with "跳过 ▸" after 1200 ms, which jumps to the recap.
3. **Day 1 free play** (45 s): fixed first three customers (1 杯 → 100 杯 → 可以少冰吗？), then a weighted mix. The HUD shows only the queue (no bars, no clock, combo only from 5).
4. **Closing card** (3.8): the day's last line is read first, then the verdict, then the card: the ticket "No.001 / 250杯 / 两个月后取餐" with today's savagest line, "第一天 打烊" / "门口排了 N 人" on two lines, the three sign types with their keys, stars, and a centered button "开第二天 ▸" that works from 1000 ms on (taps elsewhere and J/K/L do nothing, so a player still mashing cannot skip it).
5. **Days 2–7** (90 s each, one new system per day, section 7): day 2 timeouts and the swagger bar, day 3 fury/rage and the two-step original-film customer, day 4 hold-to-charge, and so on. The report card shows the ★1 goal; reaching it opens the next day, otherwise the day is replayed.

Per customer (4.1): head pops up → sign rises (signUp) → the customer talks once the clerk is quiet and the clerk's subtitle has been read → the answer window starts when they finish (t0, clamped to signUp + 250…1600 ms) and shows as a bar on the sign → press → the sign leaves at once, the clerk's line plays as setup | silence | punch with the three-beat face, 花字, "+N" flying into the door monitor and the customer flying out on the punch → a landing pause before the next one: at least L, the punch 花字 and the subtitle's reading time (max(1500 ms, 140 ms per character)). A new customer clears whatever 花字 and clerk pose is left.

Controls: tap the three keys, or **J / K / L**. A press resolves at once; holding on to 300 / 800 ms upgrades that same answer (charge level 1 / 2). Enter or Space taps the visible card. **中/EN** and **消音 / Bleep** work everywhere.

## Test

```bash
cd game
node --test test/*.test.mjs        # 169 tests: engine 60, audio 29, art 16, opening 16, huazi 13, hant 10, integration 9, days 8, ui 8
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
    shot-ui.mjs         ui-demo.html screenshots
    pw.mjs              Playwright locator
    voice/              offline AI voice-pack builder (export-lines.mjs, build_voice.py)
    shots/              screenshots (git-ignored)
  voice/                generated voice pack (manifest.json + mp3 sprites)
  art-demo.html, audio-demo.html, ui-demo.html
```

## Module contracts

Each module's full contract is in the comment at the top of its file. In short:

- **engine** `createGame({ customers, rng, config })` → `{ start, tick, press, charge, speechDone, delayNext, pause, resume, bonus, on, off, state, config }`. Events: `start`, `arrive`, `ready {customer, patienceMs, step}` (t0: the window starts), `step` (first step of a two-step customer), `resolve {…, cutIn, land, step}`, `polite`, `charge`, `bonus`, `rageStart`, `rageHit`, `rageEnd`, `milestone`, `over`. While `current.speaking` patience does not run; a press then is a cut-in (reaction 0). Landing pauses: `landMs` / `landBigMs` (curse, 250, charge 2) / `landWrongMs` / `landPoliteMs`; `delayNext(ms)` lengthens one. `auraWrong: 0`: a wrong key never costs swagger.
- **days** `DAYS`, `dayInfo(n)`, `configForDay(n, extra)`, `poolForDay(n, customers)`, `clampDay(n)`.
- **opening** `runOpening({ ui, audio, content, lang, onDone, now, schedule, cancel, storage, skippable })` → `{ press(key), skip(), stop(), active, waiting, beat, elapsed }`. Beat times may also be `['max', a, b]` and `['beat', id, ms]`; "调你妈！" holds `CLIMAX_HZ_MS` (1400 ms) before "黄金比例最好喝！". A first wrong press plays its quip with the keys live: after `quipCutMs` (250 ms) the right key cuts it and answers, a wrong one gives "算了，我自己来。" at once. Later timeouts rotate `timeout.notMeAlt`. `content` / `lang` may be getters (a language switch applies from the next line). `onDone({ skipped, queue: 12 })` at F4. It never touches the engine.
- **art** `CLERK_SVG`, `SHOP_SVG`, `COUNTER_SVG`, `customerSVG()`, `signSVG()`, `signText()`, `miniSign()`, `KEY_ICONS`, `FINGER_SVG`, `DOOR_GATE_SVG`, `STAR_SVG`, `ticketHTML()`, `monitorHTML()`, `queueCapText()`; the CSS hooks (classes / data attributes) are listed in its header.
- **huazi** `pickHuazi(line, ctx)`, `createHuaziTracker({ mode, lang })` (one S1 per 3 customers, no keyword twice within 5).
- **hant** `toHant(text)` (idempotent), `PHRASES` (character-form fixes), `TW_PHRASES` / `TW_WHOLE` / `TW_PUNCT` (Taiwan wording, see `docs/localization-tw.md`), `HANT_CHARS`, `HANT_SAME`. Regenerate after adding text with new characters: `pip install opencc-python-reimplemented`, convert every Han character in `src/*.js` with `OpenCC('s2tw')`, keep pairs that differ, add two-character phrases where the character map disagrees with OpenCC (`test/hant.test.mjs` lists unknown characters).
- **ui** `createUI(root, { onPress, onCharge, onStart, onToggleLang, onToggleBleep })`: HUD (`render`, `setHud`, `setQueue`, `setTicket`, `setTexts` (also relabels the scene props), `setScript('hans'|'hant')`, `queueGain(n)`), clerk (`setClerk`, `setClerkFlags`, `clerkBeat`, `clerkTap`, `resetClerk`), customer and sign (`showCustomer`, `showSign`, `signExit`, `signFx`, `startSignTimer`, `customerReact`, `customerPose`, `showPlate`), camera and fx (`camera`, `flash(ms)`, `speedLines(ms)`, `shake`, `freeze` (hit-stop: 花字 keep playing), `letterbox`, `gate`, `goldsign`), 花字 (`huazi(list, timing)`, `clearHuazi`), subtitles (`showLine`, `emphasize`), guidance (`guide`, `clearGuide`, `hintCorrect`, `tip`, `breathKey`, `coverKey`, `lockInput`, `unlockInput`, `inputLocked`), screens (`showStart`, `fontsReady`, `showClosing`, `showRecap`, `showSkip`, `showSummary`, `showMilestone`). Pure exports for tests: `createFxQueue`, `chargeLevel`, `FOCUS`, `camTransform`, `rectsOverlap`, `placeHuazi`, `hzFontSize`, `hzMaxScale`.
- **audio** `createAudio()`: `unlock`, `setLang`, `setBleep`, `loadVoicePack`, `playClerk(text, { punchGapMs, punchFx, bedBackMs, style })` (returns a Promise carrying `{ setupMs, punchStartMs, punchMs, totalMs }`), `playCustomer(text, { rate })` (`{ ms }`), `voiceTimings`, `cut`, `hush`, `duck` / `restore`, `bed`, `loop` / `stopLoop(s)`, `sfx(name, opts)`, `crowd`, `speak`, `stopSpeech`, `announce`, `setVoiceFx(on | tuning)` / `voiceFx`, `setLite(on)`; `createAudio({ voiceFx })`.
- **voice punch** (`VOICE_FX`, `voicePlan()` in `src/audio.js`; Kokoro has no emotion, so the hit is made in the mix). The hit of a clerk line (the half after `|`; the curse half when the curse comes first, as in "调你妈！\|黄金比例最好喝！"), rage lines and the 调你妈 climax play through WaveShaper saturation (gentle; curse / mega / rage use the spec's k = 8 curve) → +5 dB (+6 hot) → DynamicsCompressor (1 ms attack) → +3 dB makeup, at playbackRate 1.06 (mega keeps 0.94), with a synthesized impact (120→45 Hz thump + 2.2 kHz noise slap) at the exact onset; rage adds a subtle megaphone band (600 Hz–3.2 kHz, 1.8 kHz bump), mega keeps the 70 ms / 25 % echo. The polite setup half plays clean and 1.5 dB softer; a hit without a setup waits 60 ms (breath). The forced-polite voice is never punched. All reported durations (`playClerk`, `voiceTimings`) include these rates and the breath, so `main.js` / `opening.js` timing stays exact. Lite mode drops the compressor, shaper and megaphone (timing unchanged); `main.js` syncs it from `ui.lite` every frame. Measured in headless Chromium on r1 / r2: setup → punch contrast 7.5 dB (was 3.7), punch peaks 0.85–0.88 (the old +4 dB chain hit 1.0).
- **content** 100 customers `{ id, cat, name, tag, cups, says, reply, alt, style, key }` per language; `reply` / `alt` of the day 1 pool carry one `|` cut point (setup | punch). Text inside `（…）` / `(…)` is a stage direction: shown small, never spoken.

### main.js integration rules

- The engine always runs on the Chinese customer list (`id`, `style`, `key`, `cups` match in both languages); every shown or spoken line is looked up by id in the current language.
- Each day builds a fresh engine from `configForDay(day)` / `poolForDay(day)`. During the opening the day 1 engine exists but is never started (A2); afterwards a new one starts with `bonus(12)` (the opening's line, no milestone popup).
- Input goes to `opening.press` while the script runs, otherwise to `game.press` after the engine clock is advanced to the press time (landing pauses are measured from the real press).
- On a correct answer the sign leaves on the press (5.2) and the customer flies on the punch; on a wrong one the sign shows the 4.4 hint for 350 ms first, and that line's 花字 wait until it is gone. A new sign removes any 花字 still showing where it rises, and an S1 slam never starts larger than the room it has next to a sign.
- `game.delayNext(max(punch end + L, setup end + 80, 花字 end − 250, subtitle reading time − signUp))` keeps the next customer from stepping on the laugh. The engine keeps a longer pause asked for inside the `resolve` / `polite` handlers (it used to reset it to L right after them, so 花字 landed on the next sign).
- Clerk subtitles drop stage directions (the face and 花字 act them out); customers show their own line when they start talking (`showCustomer(…, { line: false })`).
- The day 1 draw does not repeat a customer while that key still has unseen ones, and "今天第一个" (#46) is only used for the round's first booked order.

## Known limitations

- **Voice pack.** Lines changed for the first-minute redesign (the opening, the `|` halves of the day 1 pool, number readings) need a full rebuild (`tools/voice/README.md`, not `--incremental`); until then `check-content.mjs` V2 fails and those lines use Web Speech with estimated timings. After the rebuild, listen to the opening once (K1: "250" must be read as 二百五十).
- **Performance on low-end devices (A13).** Camera glides on the SVG scene were most of the cost (about 16% long frames at 4x CPU in headless Chromium). A K4 lite mode now switches itself on when a 30-frame window has 6+ frames over 32 ms (camera cuts instead of glides, no idle loops, no spinning rays); with it the 4x-CPU opening measures 4.5–5.7% long frames (target ≤ 5%), so A13 is borderline here and needs a real-phone check. Headless runs that take many screenshots can trip lite mode too; add `?lite=0` for visual QA (`?lite=1` forces it).
- **Google Fonts** may be blocked (the sandbox proxy here); the game falls back to system fonts.
- **Rage may swallow the original customer** on day 3+: during rage every press is a hit, so a two-step customer standing at the counter then is resolved as a rage hit.
node --test test/*.test.mjs        # 169 tests: engine 60, audio 29, art 16, opening 16, huazi 13, hant 10, integration 9, days 8, ui 8
- **Day 1 pace**: with readable subtitles a day 1 customer takes about 4–5 s (about 9–10 customers in 45 s with estimated speech lengths; the spec estimated about 13). Re-check after the voice pack rebuild.
- **The tab must be visible.** `dt` is capped at 100 ms per frame, so a backgrounded tab effectively pauses the game.
- **Half-width parentheses are always stage directions**, so ordinary English parentheses in content are hidden from speech too.
- **Audio sourcing for a release build:** see [audio sourcing notes](../docs/audio-sourcing.md).
