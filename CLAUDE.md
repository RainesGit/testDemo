# CLAUDE.md

Guidance for AI assistants (Claude Code and similar) working in this repository.

## What this repository is

`RainesGit/testDemo` holds **《来250杯！》("250 Cups!")**, a vertical mobile comedy
game: the player is a rude bubble-tea clerk on a towering counter, customers only
show half a head, and every insult makes the queue outside grow. It is currently a
playable **web prototype** plus design and voice documents.

```
AGENTS.md               Entry point for Codex and other agents; points here and to the acceptance checklist
docs/
  game-design.md        Full game design document (Simplified Chinese) — source of truth for rules
  gameplay-v2.md        Gameplay v2 (2026-10-05 expert panel): feel, rage rework, 7 daily rules, meta; wins over
                        first-minute-spec.md 4.2/7 and game-design.md on gameplay (the day 1 opening script stays);
                        stage 1 (jab/next, speed multiplier, rage rework, forced politeness) and stage 2 (preview + fast
                        mouth, daily rules, mini events, shutter, stars / rating / bests) are implemented (8.1, 8.2)
  lines-v2-draft.md     Draft lines for gameplay v2; the stage 2 parts (boss, meter, events, group, change-order,
                        shutter) are in SYSTEM of content.*.js, the stage 3 three-key matrix is not yet
  first-minute-spec.md  First-minute redesign spec (art, day-1 opening script, pace, 花字, days 1–7); wins
                        over game-design.md where they conflict
  acceptance-checklist.md  Item-by-item acceptance checks with pass criteria and report format
  lines-zh.md           100 customer types with clerk lines (v3)
  localization-tw.md    Taiwan wording for the zh-TW display (mapping table, HK notes, voice re-word list)
  audio-sourcing.md     Royalty-free SFX/music/voice sources and licensing notes
  voice/
    voice-bible.md      Voice direction: clerk voice, delivery marks, system lines, English "250" plan
    voice-script-zh.md  Chinese recording script (100 customers)
    voice-script-en.md  English transcreated recording script (100 customers)
game/                   Web prototype (plain HTML/CSS/ES modules, zero dependencies, no build)
  index.html, style.css (all art CSS: palette, clerk moods, signs, 花字 layer, keys, cards)
  src/engine.js         Pure game logic (no DOM); rules + events (talking phase, landing pauses, two-step customer,
                        v2 stage 1: jab / summon, speed multiplier, buffered presses, rage heads, forced politeness;
                        stage 2: preview, fast mouth, specials, group box, change-order, boss, 250 meter, events, shutter)
  src/days.js           Days 1–7 tuning, pools, unlock order, daily rules, ★2/★3 conditions, evaluateDay (pure data)
  src/events.js         Mini events (megaphone, phone, calculator, stamp, shutter): pure state machines the engine drives
  src/opening.js        Day 1 opening script director (beat list; the engine stays idle)
  src/art.js            All SVG art as pure string templates (clerk, shop, customers, signs, monitor)
  src/huazi.js          花字 (caption) picking and rate limits (pure)
  src/hant.js           Simplified → Traditional display conversion (zh-TW / zh-HK / zh-MO), generated with OpenCC,
                        plus Taiwan wording (TW_PHRASES; see docs/localization-tw.md)
  src/ui.js             DOM rendering, camera, 花字 rendering, guidance, cards
  src/audio.js          Procedurally synthesized SFX (WebAudio), AI voice-pack playback with "|" cut points, runtime voice
                        punch chain (VOICE_FX; ?punchfx=0 turns it off), Web Speech fallback, bleep
  src/content.zh.js / content.en.js / content.js   Customer + system lines per language (incl. SYSTEM.opening)
  src/main.js           Wires everything together (start → opening → days)
  test/*.test.mjs       node:test unit tests (engine, days, opening, art, huazi, audio, ui, integration, events, stage2)
  tools/                Playwright smoke/QA scripts, the day 1 pace measurement and the 4-bot balance harness (bots.mjs)
                        (screenshots and node_modules are gitignored)
  art-demo.html         Art sheet of every clerk mood, customer, sign and monitor scene
  tools/voice/          Offline AI voice-pack builder (Kokoro-82M, Apache-2.0); see its README
  voice/                Generated voice pack: manifest.json + mp3 sprites per language
  README.md             Prototype details, module contracts, known limits
```

## Commands

Run from `game/`:

- **Unit tests:** `node --test test/*.test.mjs` (Node 22; passing a directory does not work).
- **Content and design-rule checks:** `node tools/check-content.mjs` (exits 1 on any failure).
- **Run locally:** `python3 -m http.server 8765`, then open `http://localhost:8765/`.
  ES modules do not load from `file://`.
- **Browser checks:** with the server running, `node tools/play-integrate.mjs` (start →
  opening → day 1 → closing card → day 2 → report); first-minute QA (spec 1.2 A1–A11):
  `node tools/qa.mjs`; opening acceptance with a wrong press, a skip and the 4x-CPU run
  (A1–A13, screenshots `tools/shots/opening-*.png`): `node tools/check-opening.mjs`;
  the "250" signature (opening, free play, day-3 original customer):
  `node tools/check-signature.mjs`; day 1 pace with real voice clip lengths (customers served per 45 s at a
  fixed 700 ms reaction, `--from=t0|sign`): `node tools/measure-pace.mjs`; balance with four scripted players
  (expert / normal / sloppy / masher, days 1–7, seeds 1–3: ★1, dead input, feedback per 10 s, rage share, early
  closes, ★2/★3 and rating; about 20 minutes at `--par=7`): `node tools/bots.mjs`; stage 2 screenshots (day card,
  fast mouth + preview, meter, each mini event, group box, change-order, boss, shutter, summary; `tools/shots/s2-*.png`):
  `node tools/shot-stage2.mjs`. All take the base URL as an argument. These use the globally installed Playwright
  and the preinstalled Chromium; do not run `playwright install`. Stop the server with
  `pkill -f "m http.server 876[5]"` (the bracket keeps pkill from matching its own shell).

## Design rules (from the producer — do not violate)

- The day 1 opening script, the key colours (滚 red, 闭嘴 purple, 收 gold; sign colour = key
  colour) and the pace of days 1–7 follow `docs/first-minute-spec.md`.

- Gameplay direction: `docs/gameplay-v2.md` (every press gets a response, every key is a full curse, the player
  performs the three beats, fast vs. fierce is the player's choice, one new rule per day; borrow Shawarma Legend's
  shell, never its "complete the order correctly" core).
- Core contrast is three beats: polite service → sudden swearing → instantly professional again.
- **Everyone at the counter can be cursed.** No "protected" customers, no
  "hold back" levels, no penalty for cursing the "wrong" way (`auraWrong: 0` in
  `engine.js` by default). The only failure is being too slow (forced polite voice).
- No delivery-rider characters, no fantasy elements, no jokes about appearance,
  gender, race, origin, politics or religion, and no customer type the clerk is
  specially gentle to.
- "250" (二百五) is the signature number and a deadpan insult; "two months later"
  and "黄金比例最好喝" are signature lines.
- Audio must be license-safe: SFX are synthesized in code; see `docs/audio-sourcing.md`
  before adding any audio file.
- Voice lines come from `game/voice/` (Kokoro AI voices). After changing any line in
  `src/content.*.js`, rebuild the pack (`game/tools/voice/README.md`); `tools/check-content.mjs`
  fails if a spoken line has no clip.
- Target markets: Taiwan first, then HK/Macau/Malaysia/Singapore, then English.
  Not mainland China or the EU. Release builds need Traditional Chinese: zh-TW / zh-HK / zh-MO browsers
  (or `?lang=zh-TW`) get it through `src/hant.js` (display only); regenerate its table when text adds new characters,
  and add mainland-only words in new text to its Taiwan wording table (`docs/localization-tw.md`).

## Development workflow

- **Branches:** `main` is the default branch. Work on the assigned feature branch
  (for example `claude/...`); do not push to `main` unless explicitly asked.
- **Commits:** clear, descriptive imperative messages.
- **Pull requests:** only open one when asked. There is no PR template.
- Run the unit tests (and the smoke test for UI changes) before committing.

## Conventions for AI assistants

1. **Verify before assuming.** Check `git ls-files`, `game/README.md` and
   `docs/game-design.md` before changing rules or structure.
2. **Keep this file current** when you add directories, commands or rules.
3. **Language:** design docs and voice scripts are in Simplified Chinese (English
   script lines in US English); code and code comments are in English.
4. **Minimal changes.** Make only the changes the task needs.
5. Repository history before the game (2021) only contained a deleted README
   about an unrelated iOS CocoaPods setup; ignore it.
