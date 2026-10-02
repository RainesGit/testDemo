# AGENTS.md

Instructions for coding agents (Codex and others) working in this repository.

- Project overview, directory layout, commands and the producer's **design rules** are in
  [`CLAUDE.md`](CLAUDE.md). Read it first; the design rules are binding for every change.
- The full game design (Simplified Chinese) is `docs/game-design.md`.

## Acceptance testing

When asked to verify, review or accept ("验收") the prototype, follow
[`docs/acceptance-checklist.md`](docs/acceptance-checklist.md) item by item and reply in
its section G report format. Report problems; do not fix code during acceptance unless asked.

Quick start (from `game/`):

```bash
node --test test/*.test.mjs          # unit + integration tests
node tools/check-content.mjs         # content completeness and design red lines
python3 -m http.server 8765 &        # serve the prototype
node tools/play-integrate.mjs        # browser smoke test (Playwright + Chromium)
node tools/qa.mjs                    # full QA matrix, 7 scenarios x 3 viewports
pkill -f "http.server 8765"
```

Playwright and Chromium are expected to be preinstalled; do not run `playwright install`.
