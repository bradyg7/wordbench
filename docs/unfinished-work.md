# Unfinished work parked in main

Written 2026-11-18 when the remaining worktrees were integrated so they could be cleared (the person's request: integrate even
unfinished work, and note it here until a later session picks it up).

## Parked as patches (`docs/parked-work/`)

These branches were recorded as merged (`git merge -s ours`) because their changes conflict with the code on main, which moved on
by about 190 commits. Their content is NOT in the code. To resume one, branch from `main` and
`git apply --3way docs/parked-work/<name>.patch`, then resolve and finish. Check each against its design folder first.

| Patch | What it was | Notes |
|---|---|---|
| `debug-dock.patch` | Codex: dock and layout shortcuts (`layout-state.ts`, `layout_shortcuts.rs`, `measure/h05-layout-checks.mjs`) | Touches `commands.rs`, `dock.ts`, `main.ts`, `shelf.ts`; likely overlaps `feature/panels` and settings |
| `debug-exports.patch` | Codex: new Word/PDF exports go to `<study>/exports/` | Contradicts AGENTS.md (documents go to Documents\Bible Workbench with the real study folder); needs the person's decision before any resume |
| `debug-help.patch` | Codex: Help guide, manual, `ui/tests/help.spec.ts` | Overlaps `feature/help` |
| `debug-reader-marks.patch` | Codex: reader marks tweaks | Overlaps `feature/marks-build`, merged |
| `pilot-release.patch` | Codex: searchable feature guide, guided demo library, capture scripts (site/) | Text only; the ~186 MB of generated demo media (.png/.webm) was moved to `C:\Users\brady\Documents\bible-workbench-demo-media` (see its README.txt) |

## Merged but not reconciled

- `feature/concordance-readiness`: its README and sheet script are kept as `design/features/concordance/readiness-branch-*`; the
  Concordance README is main's. See the end of that README.
- `codex/rust-python-retirement`: a design handoff doc only (`docs/minimized-tabs-design-handoff.md`).

## Not merged

- Generated noise left uncommitted in old worktrees (screenshots in `docs/phase2/`, `package-lock.json`, CRLF-only changes to
  `design/features/words/data/*.json`) was not kept.
