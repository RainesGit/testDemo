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
  acceptance-checklist.md  Item-by-item acceptance checks with pass criteria and report format
  lines-zh.md           100 customer types with clerk lines (v3)
  audio-sourcing.md     Royalty-free SFX/music/voice sources and licensing notes
  voice/
    voice-bible.md      Voice direction: clerk voice, delivery marks, system lines, English "250" plan
    voice-script-zh.md  Chinese recording script (100 customers)
    voice-script-en.md  English transcreated recording script (100 customers)
game/                   Web prototype (plain HTML/CSS/ES modules, zero dependencies, no build)
  index.html, style.css
  src/engine.js         Pure game logic (no DOM); rules + events
  src/ui.js             DOM rendering and effects
  src/audio.js          Procedurally synthesized SFX (WebAudio), AI voice-pack playback, Web Speech fallback, bleep
  src/content.zh.js / content.en.js / content.js   Customer + system lines per language
  src/main.js           Wires everything together
  test/*.test.mjs       node:test unit tests (engine, audio bleep splitter)
  tools/                Playwright smoke/QA scripts (screenshots and node_modules are gitignored)
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
- **Browser smoke test:** with the server running, `node tools/play-integrate.mjs`;
  full QA matrix: `node tools/qa.mjs`. These use the globally installed Playwright
  and the preinstalled Chromium; do not run `playwright install`.

## Design rules (from the producer — do not violate)

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
  Not mainland China or the EU. Release builds need Traditional Chinese.

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
