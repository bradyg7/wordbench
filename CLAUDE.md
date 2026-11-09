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
  front matter for notes and threads, JSON for highlights), so both apps can open it. Deletes go to `.trash/`. A deleted
  note or question is erased after 7 days there, unless put back (the person's decision, 2026-11-03; the window does it
  when it opens, `wb trash empty` from a terminal), or at once with Erase now in the Trash, asked to confirm (the
  person's decision, 2026-11-04; `wb trash erase <name>`). Nothing else is erased. New fields (`also`, `threads`; a page's `parent`, `order`, `pinned`), the
  `notes/_threads/` and `notes/_days/` folders (today's page: no anchor), `settings/notebook.json`, `findings/` (the
  person's findings about the app, beside `notes/` so the Notebook never lists them) and `.trash/reading-unmarked.jsonl`
  (a mark taken off the reading log) are ones the Python app keeps or passes over.
- **Everything is a page, in the window; the files do not move** (the person's decision, 2026-11-09, `docs/redesign-R1.md`).
  A note, a question, a day and a thread are shown as pages; "note" is the old word. The files stay where the Python app
  has them. A thread is its `threads/<slug>.md` read as a page (`thread:<slug>`; its note is the page's text, so no field is
  ever added to a thread file, which both apps rewrite from a fixed model); where it sits in Pinned is in
  `settings/pages.json`. A question written in a page is a callout line (`> [!question]`, `> [!done]`); a thread or a word
  put in a page is a ```` ```thread ```` or ```` ```word ```` fence holding only an id or a number, never the text. `wb page …`
  is `wb note …` under the new name. `scripts/py-opens.py` and `wb study check` are the check that the Python app still
  opens the folder.
- **The Bible database is read-only.** `WB_BIBLE_DB` (default: the Python repo's `datasets/workbench.db`) is opened with
  SQLite's read-only flag. Never modify it.
- **Never lose the reader's place.** Anything opened from the text returns to the verse it came from.
- **Every core action is reachable from a `wb` command.** When wb-core gains an action, `wb` gains a command for it, so the
  person (or an AI) can do from a terminal anything the window does.

## Layout

| Path | What |
|---|---|
| `crates/wb-core` | Everything that is not drawing: `bible` (read-only SQLite), `places` (references), `lookup`, `scripture`, `anchors`, `store` (the study files), `studyapi`, `reading` (plans and progress), `cache`, `marks`, `views`, `commands` (the command language), `notebook` (journal, inbox, placing), `pages` (pages inside pages, Pinned, a page's blocks, thread and word blocks), `threadpage` (a thread as a page), `questions` (questions written in a page, and the one list of them), `check` (the read-only check of the folder), `relay` (`wb do`), `docs` (documents from a thread or a page: the plans, the Word writer, the PDF deck through Typst, `documents/` records; its fonts in `crates/wb-core/fonts`) |
| `crates/wb-cli` | The `wb` command table (a library the app runs in-process) and the `wb` binary |
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
python scripts/golden.py                     # the Rust wb against the Python wb on the same inputs (scratch folders)
python scripts/doc-plans.py                  # documents' plans: the Rust fingerprints against the Python app's (scratch folder)
python scripts/py-opens.py                   # the Python app opens the scratch folder and reads what this app reads (--save / --compare: before and after a change)
node scripts/commands-cases.mjs              # the command language's cases and manual, from the Python app's commands.js
node measure/desk.mjs                        # the desktop checked in the real app (its own instance and scratch copy)
npm run measure                              # the speed budgets (after npx tauri build --no-bundle)
powershell -File scripts\backup-study.ps1   # a hashed copy of the real study folder (reads it only), before the app uses it
powershell -File scripts\install-app.ps1    # the release build into %LOCALAPPDATA%\bible-workbench-rs\app (refuses while it is open)
```

The Rust `wb` must give the same output as the Python `wb`: when changing a command, add or update its case in
`tests/golden/cases.json` and run the golden tests. Known, deliberate differences are listed in docs/phase1-results.md. Rust tests: `cargo test` (the Python app's
own tests carried over, plus the reading plans).

Documents (Word files, PDF slides) go to `WB_DOCS_DIR`; with the person's real study folder, to the Python app's folder
(Documents\Bible Workbench), where its documents already are; with any other study folder, to a folder beside it
(`<study>-documents`), so tests and scratch copies never write the person's documents. After a document is made, every
verse the source holds is checked in the finished file; one that fails is not kept.

No remote yet: do not push anywhere without the person's go-ahead.
