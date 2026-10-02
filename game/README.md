# 来250杯！ / 250 Cups!

A playable web prototype of a vertical (portrait) phone game about stress relief. You play a cocky bubble-tea clerk sitting on a very high counter in a Taiwanese tea shop. Customers peek up from below and order. Answer each one fast with **滚 / 闭嘴 / 收** (Scram! / Zip it! / Booked!). The ruder you are, the longer the line gets. The only way to lose is being too slow: then the clerk is forced into a sugary service voice and the whole shop boos.

The prototype uses plain HTML, CSS and native ES modules, with no dependencies and no build step. All sound effects are synthesized with WebAudio. Voice lines play from the generated AI voice pack in `voice/` (Kokoro-82M, see `tools/voice/README.md`); lines without a clip fall back to the browser's Web Speech API.

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
| `?lang=zh` / `?lang=en` | Starting language. Otherwise the game uses the saved choice, then `navigator.language`. |
| `?bleep=1` | Starts with bleep mode on. |
| `?debug` | Exposes `window.__250 = { game, audio, ui, getContent }` for automated tests. |

Controls:
- Tap the three buttons, or use **J / K / L** on a keyboard.
- **Press to curse, hold to curse harder.** The answer resolves the moment the button (or key) goes down, so the clerk curses immediately. Keeping it held upgrades that same answer: level 1 at 300 ms (bigger shake), level 2 at 800 ms (bigger shake, flash, bigger slam word and a short shouted rage line). Releasing does nothing. A charge only applies to a correct answer resolved by that same press within `chargeWindowMs` (1 s).
- **Beginner protection.** Customers who arrive in the first 10 s get a fixed 4.5 s of patience, and the first timeout of each round costs no aura (it still plays the polite scene, resets the combo and counts as polite).
- **250 signature scene.** The first correct 收 on a 250-cup customer in a round pauses the game and plays the scripted `signature250` routine line by line (clerk lines as subtitles, customer lines in the bubble, each voiced, at most 4 s per line). Input is locked while it plays; tap the stage or press Enter / Space / Esc to skip (taps in the first 600 ms are ignored). When it ends the line grows by a further 25 and play resumes.
- **One big effect at a time.** The PERFECT, 250 and rage banners and the milestone card play one after another (at most 900 ms each, at most 4 waiting).
- Enter or Space starts the game from the start card and the report card.
- The **中/EN** and **消音 / Bleep** toggles work during play and on the start and report cards.

Audio starts only after you press 开店 / Open Shop, because browsers require a user gesture before playing sound.

## Test

```bash
cd game
node --test test/*.test.mjs        # engine + audio + ui + integration (62 tests)
node tools/check-content.mjs       # content + design-rule checks (B/C/V items of the acceptance checklist)
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
                                # The 250 signature scene pauses the round; qa.mjs and play-integrate.mjs skip it
                                # with a tap, and the charge scenario reads levels from the 'charge' event.
node tools/check-signature.mjs  # plays until a 250-cup customer, presses 收 and checks the signature scene:
                                # engine paused + skip layer + first line shown, J/K/L and buttons ignored,
                                # queue +25 afterwards, once per round. Runs once to the end, once skipped.
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
    content.en.js       100 customers + SYSTEM_EN (US English; 250 = "quarter-wit" slip / "out of a thousand")
  test/
    engine.test.mjs     engine rules incl. intro patience, free first timeout, charge, pause/bonus (38)
    audio.test.mjs      bleep splitting, stage-direction stripping, voice styles (15)
    ui.test.mjs         effect queue, charge levels (3)
    integration.test.mjs content shape, zh/en gameplay-field parity, full round, signature flow (4)
  tools/
    check-content.mjs   content and design-rule checks
    play-integrate.mjs  end-to-end Playwright run
    shot-ui.mjs         UI screenshot / overflow check
    qa.mjs              full-round QA matrix (scenarios x viewports)
    check-signature.mjs 250 signature scene browser check
    voice/              offline AI voice-pack builder (export-lines.mjs, build_voice.py)
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
- `press(key, holdMs)`: resolves the current customer (the UI always passes `holdMs = 0`; force comes from `charge`)
- `charge(level)`: upgrades the last answer to charge level 1 or 2 if it was correct and resolved within `chargeWindowMs`; adds only the difference in `chargeBonus` to queue and score. Wrong answers, late charges, repeats and downgrades are ignored.
- `pause()` / `resume()`: freeze the round for a cutscene; `tick`, `press` and `charge` do nothing while paused
- `bonus(n)`: queue +n, score +100n (used after the signature scene)
- `on(event, fn)`, which returns an unsubscribe function
- `off()`
- `state`, a frozen snapshot shaped `{ phase, paused, timeLeftMs, queue, aura, fury, combo, maxCombo, score, rageLeftMs, current, stats }`

Events:
- `start`
- `arrive {customer}`
- `resolve {customer, key, correct, perfect, charge, queueDelta, scoreDelta, line, reactionMs}`
- `polite {customer, free}` (`free: true` for the round's first timeout, which costs no aura)
- `charge {level, queueDelta, customer}`
- `bonus {queueDelta}`
- `rageStart`
- `rageHit {queueDelta, key}`
- `rageEnd`
- `milestone {level}`
- `over {summary}`

Rules:
- A round lasts 90 s.
- Aura starts at 60.
- A correct answer gives +8 aura, or +12 for a perfect answer (reaction under 600 ms).
- A wrong answer leaves aura and combo unchanged and still counts as a curse, with a smaller reward.
- A timeout gives -20 aura and resets the combo. The first timeout of a round is free (`firstTimeoutFree`): no aura loss, combo still resets.
- When aura reaches 0, the game is over.
- Each correct answer adds `1 + floor(combo/5) + 10 (style 250 or cups 250)` people to the line; a later `charge(1|2)` adds 1 or 3 more.
- Fury rises by 6 per customer and by 4 per correct answer. At 100, rage mode runs for 8 s. During rage every press is a hit worth `2 + floor(combo/10)`, and nobody times out.
- Patience shrinks linearly from 3000 ms to 1200 ms over the round. Customers arriving in the first `introMs` (10 s) get a fixed `introPatienceMs` (4500 ms).
- Two customers in a row never share the same style.

The tunables are in `DEFAULT_CONFIG`; new in this version: `chargeWindowMs: 1000`, `introMs: 10000`, `introPatienceMs: 4500`, `firstTimeoutFree: true`. `main.js` adds `SIGNATURE_BONUS = 25` and `SIGNATURE_LINE_MAX_MS = 4000`.

### ui

`createUI(root, { onPress(key, holdMs), onCharge(key, level), onStart(), onToggleLang(lang), onToggleBleep(on) })` returns these methods. `onPress` fires on pointerdown / keydown; `onCharge` fires while the same press is still held (level 1 at 300 ms, level 2 at 800 ms).
- `render(state)`
- `showCustomer(c)`, `relabelCustomer(c)` (language switch, no animation)
- `showLine(text, {style, who})`
- `effect(name, payload)`, where `name` is one of `hit | miss | perfect | 250 | polite | rageStart | rageEnd | fly | charge`
- `showMilestone(level, text)`: `text` may be a getter so a queued or visible card follows a language switch; `relabelMilestone()` re-renders the visible card
- `beginSignature(onSkip, hint?)` / `endSignature()`: show / hide the tap-to-skip layer and lock the buttons
- `showStart(texts)`
- `showSummary(summary, texts)`
- `setTexts(ui)`

Long customer lines shrink the bubble font, and long clerk subtitles step down in size until they fit. The module also exports `createFxQueue` (the one-big-effect-at-a-time queue) and `chargeLevel(ms)`.

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
- **Charge.** A charge only goes through if the press that started the hold resolved a correct answer, so holding during the gap between customers cannot upgrade the previous one. A level-2 charge speaks a short line from the shorter half of `rageLines` and shows it as a subtitle.
- **250 signature scene.** Triggered once per round by a correct 收 on a `cups === 250` customer. It replaces that customer's normal reply, re-reads the content each line (so a language switch mid-scene applies), and if fury fills meanwhile, rage starts after the scene.
- **Rage.** The rage opening line plays first. Then `rageLines` are chanted one after another until rage ends. Every hit also stacks a subtitle.
- **Best line.** For "最狠一句", main.js remembers whether the best-scoring resolve used `reply` or `alt`, and shows that same line in the current language.
- **Crowd sound.** The crowd ambience scales with log10 of the line length.

## Known limitations

- **Voices.** Lines play from the AI voice pack; after any line change in `src/content.*.js` the pack must be rebuilt (`tools/voice/README.md`), otherwise `check-content.mjs` V2 fails and those lines fall back to Web Speech, whose quality depends on the device. iOS needs the silent switch off. Headless tests cannot judge how anything sounds, so a listening pass on real phones is still needed. Some engines ignore `pitch`.
- **Speech can lag behind fast play.** At fast play the clerk's line is often cut off by the next press. This is by design, because tempo matters more than finishing the sentence.
- **The signature scene is long when played out.** With voices it runs about 25 s; most players will skip it after the first time.
- **Strike-through subtitles are not implemented.** The English "quarter-wit" slip (#47 and the signature scene) shows as plain text.
- **Chinese is Simplified throughout.** Content, UI labels and scene decor (menu board, 点餐处, 店长, slam words) all use Simplified Chinese; the scene decor also switches to English in EN mode.
- **Rants vs. Served.** The report's "Rants / 开骂" (`stats.cursed`) includes rage hits, so it is usually much larger than "Served / 接客".
- **The best line is chosen by score.** "Savagest line" is the line with the highest single `scoreDelta`. That is usually a 250 or charged hit, not necessarily the funniest line.
- **The tab must be visible.** `dt` is capped at 100 ms per frame, and a backgrounded tab effectively pauses the game. There is no explicit pause button.
- **Half-width parentheses are always stage directions.** `audio.js` and `ui.js` treat any `(...)` as a stage direction, so ordinary English parentheses in content are hidden from speech too.
- **Audio sourcing for a release build.** For licensing and sourcing options for real voice-over and SFX, see [audio sourcing notes](../docs/audio-sourcing.md).
