# CLAUDE.md

Guidance for AI assistants (Claude Code and similar) working in this repository.

## Current state of the repository

This repository (`RainesGit/testDemo`) is **effectively empty**. Apart from this
`CLAUDE.md`, the working tree has no source code, build configuration, tests, or
CI setup.

Git history (both `main` and feature branches share it):

| Commit    | Author   | Date       | Change                                   |
|-----------|----------|------------|------------------------------------------|
| `d59bffa` | liangjie | 2021-07-01 | `[update]` — added `README.md` (Chinese) |
| `a4169f8` | Raines   | 2021-07-01 | `Delete README.md`                        |

### Historical context (deleted README)

The deleted README (see `git show d59bffa:README.md`) described setting up an
**iOS CocoaPods binary-component workflow**:

1. Create a private CocoaPods spec repo for binary pods and add it locally:
   `pod repo add example_spec_bin_dev git@github.com:su350380433/example_spec_bin_dev.git`
2. Install MongoDB 4.0.9 (macOS tarball) under `/usr/local/mongodb` and create
   `/data/db`.
3. Start MongoDB with `sudo mongod`.
4. Start a static binary server from a sibling `../binary-server` directory
   with `npm install && npm start` (requires `mongod` running).

None of those components (`binary-server`, podspecs, etc.) exist in this
repository. Treat this as background only. It does not describe code you can
build or run here.

## Development workflow

- **No build, lint, or test commands exist yet.** Do not claim to have run
  tests; there are none. If you add code, also add the tooling to verify it
  and document the commands in this file.
- **Branches:** `main` is the default branch. Do work on the feature branch
  you were assigned (for example `claude/...`), and do not push directly to
  `main` unless explicitly asked.
- **Commits:** Existing history uses short, informal messages. Prefer clear,
  descriptive imperative messages (for example `Add CLAUDE.md with repo overview`).
- **Pull requests:** Only open one when asked. There is no PR template.

## Conventions for AI assistants

1. **Verify before assuming.** The repo is nearly empty, so do not invent
   structure, frameworks, or commands. Check with `git ls-files` and
   `git log` first.
2. **Keep this file current.** When you add meaningful structure (languages,
   directories, build/test commands, CI), update the sections above so they
   match reality.
3. **Language:** The original author wrote docs in Chinese. English is fine
   for new docs unless the user asks otherwise. Keep a single file in one
   language.
4. **Minimal changes.** Make only the changes the task needs. Don't add
   scaffolding nobody asked for.
