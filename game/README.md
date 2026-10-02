# 来250杯！ / 250 Cups!

A playable web prototype of a vertical (portrait) phone game about stress relief. You play a cocky bubble-tea clerk sitting on a very high counter in a Taiwanese tea shop. Customers peek up from below and order. Answer each one fast with **滚 / 闭嘴 / 收** (Beat it / Zip it / Rung up). The ruder you are, the longer the line gets. The only way to lose is being too slow: then the clerk is forced into a sugary service voice and the whole shop boos.

The prototype uses plain HTML, CSS and native ES modules, with no dependencies and no build step. All sound effects are synthesized with WebAudio. Voices come from the browser's Web Speech API. No audio files are shipped.

## Run

```bash
cd /home/user/testDemo/game
python3 -m http.server 8765
# open http://127.0.0.1:8765/  (phone: same LAN IP; use portrait)
```

Opening the page with `file://` will not work because ES modules need a server.

URL parameters:

| Param | Effect |
|---|---|
| `?lang=zh` / `?lang=en` | Starting language. Otherwise the game uses the saved choice, then `navigator.language`. |
| `?bleep=1` | Starts with bleep mode on. |
| `?debug` | Exposes `window.__250 = { game, audio, ui, getContent }` for automated tests. |

Controls:
- Tap the three buttons, or use **J / K / L** on a keyboard.
- Holding a button charges it. Releasing after 300 ms gives charge level 1; after 800 ms, level 2. Higher charge adds more people to the line.
- Enter or Space starts the game from the start card and the report card.
- The **中/EN** and **消音 / Bleep** toggles work during play and on the start and report cards.

Audio starts only after you press 开店 / Open Shop, because browsers require a user gesture before playing sound.

## Test

```bash
cd /home/user/testDemo/game
node --test test/*.test.mjs        # engine + audio + integration (44 tests)
```

`node --test test/` with a bare directory fails on Node 22, so use the glob above.

Browser checks use Playwright with the preinstalled Chromium. Start the server on port 8765 first.

```bash
node tools/play-integrate.mjs   # opens index.html at 390x844, starts the game, plays ~20 s with J/K/L,
                                # forces a polite timeout, rage and a milestone, switches to EN + bleep,
                                # reaches the report card and plays again. Fails on any console/page error.
                                # Screenshots: tools/shots/integrate-*.png
node tools/shot-ui.mjs          # UI states from ui-demo.html at 3 viewports + overflow checks
node tools/qa.mjs               # QA matrix: 7 scenarios (all correct, all wrong, idle, hold-to-charge,
                                # rage, English, bleep) x 3 viewports (390x844, 360x640, 1280x800), each a
                                # full 90 s round fast-forwarded with game.tick(). Checks console errors,
                                # horizontal overflow, hit areas, clipped text, report card, leftover CJK in
                                # English mode. Add --only=<scenario> to run one. Screenshots: tools/shots/qa-*.png
```

The scripts load `playwright` from `tools/node_modules` if it is installed there. Otherwise they use the global install at `/opt/node22/lib/node_modules/playwright`.

Demo pages:
- `ui-demo.html` shows every UI state with fake data.
- `audio-demo.html` has buttons for every sound effect and voice style.

## Layout

```
game/
  index.html            entry page (empty #app + src/main.js)
  style.css             all styling; stage scales with container units (cqw)
  src/
    main.js             integration: wires content + engine + ui + audio, main loop, speech scheduling
    engine.js           pure game logic (no DOM), deterministic with injected rng
    ui.js               DOM, input (hold-to-charge, J/K/L), effects, start/report cards
    audio.js            WebAudio SFX synth, crowd ambience, speechSynthesis, bleep splitting
    content.js          getContent(lang) → { customers, system }, merges en over zh by id
    content.zh.js       100 customers + SYSTEM_ZH (Simplified Chinese)
    content.en.js       100 customers + SYSTEM_EN (US English, "CODE 250")
  test/
    engine.test.mjs     engine rules (27)
    audio.test.mjs      bleep splitting, stage-direction stripping, voice styles (13)
    integration.test.mjs content shape, zh/en gameplay-field parity, full round with real content (4)
  tools/
    play-integrate.mjs  end-to-end Playwright run
    shot-ui.mjs         UI screenshot / overflow check
    qa.mjs              full-round QA matrix (scenarios x viewports)
    shots/              screenshots (git-ignored)
  ui-demo.html, audio-demo.html
```

## Module contracts

### content

- `content.zh.js` exports `CUSTOMERS_ZH`, an array of 100 entries shaped `{ id, cat, name, tag, cups, says, reply, alt, style, key }`, and `SYSTEM_ZH`, shaped `{ next, polite, boo, rageStart, rageLines, milestones, closing, ui, signature250 }`.
- `content.en.js` has the same shape: `CUSTOMERS_EN` uses the same ids, and `SYSTEM_EN` mirrors `SYSTEM_ZH`.
- `style` is one of `real | curse | disdain | cold | deadpan | chuuni | math | 250 | twist`.
- `key` is one of `gun | shut | take`.
- Text inside `（…）` or `(…)` is a stage direction. It is shown small and is never spoken.
- `content.js` provides `getContent(lang)`. It merges English over Chinese by id, field by field, and falls back to Chinese for anything missing.

### engine

`createGame({ customers, rng = Math.random, config = {} })` returns a game object with these members:
- `start()`
- `tick(dtMs)`
- `press(key, holdMs)`
- `on(event, fn)`, which returns an unsubscribe function
- `off()`
- `state`, a frozen snapshot shaped `{ phase, timeLeftMs, queue, aura, fury, combo, maxCombo, score, rageLeftMs, current, stats }`

Events:
- `start`
- `arrive {customer}`
- `resolve {customer, key, correct, perfect, charge, queueDelta, scoreDelta, line, reactionMs}`
- `polite {customer}`
- `rageStart`
- `rageHit {queueDelta, key}`
- `rageEnd`
- `milestone {level}`
- `over {summary}`

Rules:
- A round lasts 90 s.
- Aura starts at 60.
- A correct answer gives +8 aura, or +12 for a perfect answer (reaction under 600 ms).
- A wrong answer gives -5 aura, but it still counts as a curse.
- A timeout gives -20 aura and resets the combo.
- When aura reaches 0, the game is over.
- Each correct answer adds `1 + floor(combo/5) + charge(0/1/3) + 10 (style 250 or cups 250)` people to the line.
- Fury rises by 6 per customer and by 4 per correct answer. At 100, rage mode runs for 8 s. During rage every press is a hit worth `2 + floor(combo/10)`, and nobody times out.
- Patience shrinks linearly from 3000 ms to 1200 ms over the round.
- Two customers in a row never share the same style.

The tunables are in `DEFAULT_CONFIG`.

### ui

`createUI(root, { onPress(key, holdMs), onStart(), onToggleLang(lang), onToggleBleep(on) })` returns these methods:
- `render(state)`
- `showCustomer(c)`
- `showLine(text, {style, who})`
- `effect(name, payload)`, where `name` is one of `hit | miss | perfect | 250 | polite | rageStart | rageEnd | fly`
- `showMilestone(level, text)`
- `showStart(texts)`
- `showSummary(summary, texts)`
- `setTexts(ui)`

### audio

`createAudio({ bleepWords?, volume? })` returns these members:
- `unlock()`
- `setLang()`
- `setBleep()`
- `setBleepWords()`
- `setVolume()`
- `speak(text, {style, rate, pitch})`, which returns a Promise
- `sfx(name, opts)`, where `name` is one of `slam | whoosh | boo | cheer | ding | pop | rage | shake | milestone | bleep`
- `crowd(0..1)`
- `stopSpeech()`
- the getters `canSpeak`, `canPlay` and `unlocked`

### main.js integration rules

- **Language.** The engine always runs on the Chinese customer list, since `id`, `style`, `key` and `cups` are identical in both languages. Every displayed or spoken line is looked up by id in the current language, so switching language mid-round takes effect on the next line.
- **Speech never holds up the game.** The engine runs on its own clock.
  - Every clerk line (reply, polite, rage, next, closing) calls `stopSpeech()` first, so a new line cuts off the old one.
  - A customer's order is spoken only once the clerk has finished, and only if that customer is still waiting. Customers speak a little faster than normal (`rate 1.3`, style `cust`).
- **Rage.** The rage opening line plays first. Then `rageLines` are chanted one after another until rage ends. Every hit also stacks a subtitle.
- **Best line.** For "最狠一句", main.js remembers whether the best-scoring resolve used `reply` or `alt`, and shows that same line in the current language.
- **Crowd sound.** The crowd ambience scales with log10 of the line length.

## Known limitations

- **Voices depend on the device.** Voice quality and availability come from the OS and browser through the Web Speech API. Desktop Linux Chromium often has no Chinese voice. iOS needs the silent switch off. Headless tests cannot judge how anything sounds, so a listening pass on real phones is still needed. Some engines ignore `pitch`.
- **Speech can lag behind fast play.** At fast play the clerk's line is often cut off by the next press. This is by design, because tempo matters more than finishing the sentence.
- **`signature250` is not played anywhere yet.** The scripted 250-cup routine exists in both content files, but no game moment triggers it. Candidates are an attract-mode loop on the start card or a cut-in when customer #47 (`cups: 250`) is served.
- **Chinese is Simplified throughout.** Content, UI labels and scene decor (menu board, 点餐处, 店长, slam words) all use Simplified Chinese; the scene decor also switches to English in EN mode.
- **Rants vs. Served.** The report's "Rants / 开骂" (`stats.cursed`) includes rage hits, so it is usually much larger than "Served / 接客".
- **Wrong presses can end the round.** Per the engine contract a wrong key costs 5 aura, so pressing only wrong keys ends the round in about 7 s. The design brief says only slowness should be punished; pass `config: { auraWrong: 0 }` to `createGame` in main.js if that is preferred.
- **The best line is chosen by score.** "Savagest line" is the line with the highest single `scoreDelta`. That is usually a 250 or charged hit, not necessarily the funniest line.
- **The tab must be visible.** `dt` is capped at 100 ms per frame, and a backgrounded tab effectively pauses the game. There is no explicit pause button.
- **Half-width parentheses are always stage directions.** `audio.js` and `ui.js` treat any `(...)` as a stage direction, so ordinary English parentheses in content are hidden from speech too.
- **Audio sourcing for a release build.** For licensing and sourcing options for real voice-over and SFX, see `/home/user/testDemo/docs/audio-sourcing.md`.
