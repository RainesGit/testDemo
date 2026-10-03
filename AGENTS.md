# AGENTS.md

Instructions for coding agents (Codex and others) working in this repository.

- Project overview, directory layout, commands and the producer's **design rules** are in
  [`CLAUDE.md`](CLAUDE.md). Read it first; the design rules are binding for every change.
- The full game design (Simplified Chinese) is `docs/game-design.md`; the first-minute redesign
  (`docs/first-minute-spec.md`) overrides it where they conflict.

## Acceptance testing

### Required model

The user requires all acceptance work (验收), including running acceptance checks,
reviewing evidence, and writing acceptance conclusions, to be delegated to a
sub-agent with exactly these settings:

- `model: "gpt-5.6-sol"`
- `reasoning_effort: "medium"` (中)

A sub-agent already running with these settings performs the acceptance work
directly; this requirement does not call for recursive delegation.

Do not perform acceptance work with the coordinating agent or silently substitute
another model or reasoning level. The coordinating agent may synchronize the
repository, maintain these instructions, relay the acceptance agent's findings,
and commit/push the resulting artifacts. If the required model cannot be started,
report the blocker to the user rather than continuing acceptance with a fallback.

### Checklist and reporting

When asked to verify, review or accept ("验收") the prototype, follow
[`docs/acceptance-checklist.md`](docs/acceptance-checklist.md) item by item and reply in
its section G report format. Report problems; do not fix code during acceptance unless asked.

Quick start (from `game/`):

```bash
node --test test/*.test.mjs          # unit + integration tests
node tools/check-content.mjs         # content completeness and design red lines
python3 -m http.server 8765 &        # serve the prototype
node tools/play-integrate.mjs        # browser smoke: opening → day 1 → closing card → day 2 → report
node tools/qa.mjs                    # first-minute QA (spec 1.2 A1–A11), 3 scenarios
node tools/check-opening.mjs         # opening acceptance A1–A13 (wrong press, skip, 4x CPU)
node tools/check-signature.mjs       # the "250" signature: opening, free play, day-3 original customer
node tools/measure-pace.mjs          # day 1 pace: customers served in 45 s at a 700 ms reaction (real clip lengths)
pkill -f "m http.server 876[5]"
```

Playwright and Chromium are expected to be preinstalled; do not run `playwright install`.
