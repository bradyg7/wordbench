# Working on Bible Workbench (Rust) — for an AI assistant

The Rust rebuild of Bible Workbench: one Rust core (`crates/wb-core`), a `wb` CLI over it (`crates/wb-cli`), and a Tauri 2
app (`app/src-tauri`) whose UI is plain TypeScript and CSS (`ui/`, no framework). The plan is [docs/PLAN.md](docs/PLAN.md);
the design decisions are [docs/PLAN-design.md](docs/PLAN-design.md). The Python app it replaces lives in
`C:\Users\brady\github\bible-workbench` and keeps working against the same study folder until the move is done.

## Rules that never change

- **Scripture is verbatim, with its reference.** Never type or paraphrase a verse from memory: not in code, tests, fixtures,
  docs, notes or documents. Fetch it from the database (`wb text "Num 25:11"`) or generate it. Test fixtures that hold
  scripture are generated from the database, not written by hand.
- **No interpretation.** The app shows source text, the person's own notes and lookups. No commentary, no doctrine, nothing
  suggested. Doctrinal questions are the person's, not the tool's.
- **The study folder is the person's real work.** `C:\Users\brady\github\bible-study-data` (notes, highlights, threads,
  trails, lessons) is never written to by tests, spikes or experiments. Use a scratch copy: `scripts/scratch-study.ps1`
  copies it to `%TEMP%\bible-workbench-rs\study-scratch`, and `WB_STUDY_DIR` points the app and `wb` there. wb-core
  refuses to open the real folder unless `WB_ALLOW_REAL_STUDY=1` is set, and nothing in this repo sets it.
- **Same files, same formats.** The study folder keeps the layout and file formats the Python app uses (Markdown with
  front matter for notes and threads, JSON for highlights), so both apps can open it. Deletes go to `.trash/`; nothing is
  erased.
- **The Bible database is read-only.** `WB_BIBLE_DB` (default: the Python repo's `datasets/workbench.db`) is opened with
  SQLite's read-only flag. Never modify it.
- **Never lose the reader's place.** Anything opened from the text returns to the verse it came from.
- **Every core action is reachable from a `wb` command.** When wb-core gains an action, `wb` gains a command for it, so the
  person (or an AI) can do from a terminal anything the window does.

## Layout

| Path | What |
|---|---|
| `crates/wb-core` | Everything that is not drawing: `bible` (read-only SQLite), `anchors`, `study` (reading the study files), `marks` |
| `crates/wb-cli` | The `wb` binary over wb-core |
| `app/src-tauri` | The Tauri 2 shell: commands that call wb-core |
| `ui/` | The UI: TypeScript, CSS, fonts (Literata for scripture, Inter for the interface), `tokens.css` from the design tokens |
| `spikes/` | Phase 0 experiments (git sync, Typst PDF), kept for reference |
| `docs/` | The plan, design decisions, phase results |

## Commands

```
cargo build                                  # the workspace
cargo run -p wb-cli -- text "Num 25:11"      # verbatim scripture
npm install && npm run tauri dev             # the app (from the repo root)
npm run test:webkit                          # the UI in Playwright's WebKit at phone size
```

No remote yet: do not push anywhere without the person's go-ahead.
