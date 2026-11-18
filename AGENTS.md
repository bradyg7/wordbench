# Working on Bible Workbench (Rust) — for an AI assistant

Read [the current spec](docs/SPEC.md) for branch status, remaining phases and the source map.

This app (`bible-workbench-rs`) is the Bible Workbench. The Python app in the sibling `bible-workbench` checkout is its
predecessor and is no longer a constraint (the person, 2026-11-12): nothing here has to stay readable by it, match it,
or keep its files' shapes. Make this app better on its own terms. The Python checkout is only a source of history and
of data this app still reads (the Bible database), and old study files are this app's to read and move forward. When
a change alters expected behavior, document the contract and verify it with Rust-owned tests.

## Rules that never change

- **Scripture is verbatim, with its reference.** Never type or paraphrase a verse from memory: not in code, tests, fixtures,
  docs, notes or documents. Fetch it from the database (`wb text "Num 25:11"`) or generate it. Test fixtures that hold
  scripture are generated from the database, not written by hand.
- **No interpretation.** The app shows source text, the person's own notes and lookups. No commentary, no doctrine, nothing
  suggested. Doctrinal questions are the person's, not the tool's.
- **The study folder is the person's real work.** `C:\Users\brady\github\bible-study-data` (notes, highlights, threads,
  trails, lessons) is never written to by tests, spikes or experiments. Use a scratch copy: `scripts/scratch-study.ps1`
  copies it to `%TEMP%\bible-workbench-rs\study-scratch`, and `WB_STUDY_DIR` points the app and `wb` there. wb-core
  refuses to open the real folder unless `WB_ALLOW_REAL_STUDY=1` is set, and nothing in this repo sets it. The one
  exception is an installed release (the `installed` feature, on only in the updater build the release workflow makes):
  it opens the folder the person chooses (the person, 2026-11-18). Tests, spikes and `cargo test` never build with it.
- **The study folder's formats are this app's to shape** (the person, 2026-11-12). They need not stay readable by the
  Python app. What the person already wrote must never be lost: a change of format reads the old form, and moving the
  person's files to a new form happens once, designed first, tried on a scratch copy, after a hashed backup
  (`scripts/backup-study.ps1`), and only with the person's go-ahead. Today the folder holds Markdown with front matter
  (pages, threads) and JSON (highlights). The current distribution checkout uses `.trash/` for legacy deletion. See the current spec for transactional page Undo on `main`. A deleted
  note or question is erased after 7 days there, unless put back (the person's decision, 2026-11-03; the window does it
  when it opens, `wb trash empty` from a terminal), or at once with Erase now in the Trash, asked to confirm (the
  person's decision, 2026-11-04; `wb trash erase <name>`). Nothing else is erased. `findings/` holds the
  person's findings about the app, beside `notes/` so the Notebook never lists them; `findings/<id>/` holds the files
  attached to a finding, copied in, 10 MB each at most.
- **Everything is a page, in the window** (the person's decision, 2026-11-09, [R1 decision record](docs/archive/2026-11-10/docs/redesign-R1.md)).
  A note, a question and a day are shown as pages; "note" is the old word. **A thread is a folder with a color** (the
  person, 2026-11-17, [threads](design/features/threads/README.md) TH-1, TH-11): its places are the saves in the folder,
  in the folder's own order; its note is a page in the folder; pages written on it are pages in the folder. The window's
  word is "folder"; `wb thread …` keeps its contracts and works on folders with a color, and `thread:<slug>` still opens
  one (TH-3). How a page is kept on disk follows the design folders (pages lose their single place for references in
  their text: [marks](design/features/marks/README.md), 2026-11-12). Today's `threads/<slug>.md` files stay where they
  are and stay readable: they are read as folders with a color (until that is built, the app shows one as a page), and
  moving them into the folders' own form happens only as a designed, backed-up move with the person's go-ahead (TH-2,
  TH-12). Pinned is in `settings/pages.json`. A question written in a page is a callout line (`> [!question]`,
  `> [!done]`); a word put in a page is a ```` ```word ```` fence, and a ```` ```thread ```` fence in a page shows the folder's
  saves; each holds only an id or a number, never the text. `wb page …` is `wb note …` under the new name.
  `wb study check` is the read-only check of what the folder holds.
- **The Bible database is read-only.** Follow [local provisioning](data/README.md) and select it with `WB_BIBLE_DB`, the
  setup screen or `wb setup database` (otherwise `datasets/workbench.db` beside the program, or in the sibling
  `bible-workbench` checkout). It is opened with SQLite's read-only flag. Never modify it.
- **Never lose the reader's place.** Anything opened from the text returns to the verse it came from.
- **Designed before it is built** (the person, 2026-11-11). Every general feature, button and command has a planned
  design in a folder under `design/features/` before it is built or changed in a way the person would see: dated
  decisions, the sheets, and "what the build must satisfy". Building starts only from a folder the person marked
  *accepted*. [`design/features/coverage.md`](design/features/coverage.md) lists every area of the app and the folder
  that designs it; a new button or command gets a row there, and its folder, first. Bug fixes that keep the accepted
  design need no new round.
- **Each feature is built on its own branch** (the person, 2026-11-13). Building an accepted design folder starts a
  branch from an up-to-date `main`, named `feature/<folder>` (`feature/trash`), and nothing else goes on it. It reaches
  `main` by a pull request, after the tests, only with the person's go-ahead. Work found on the wrong branch moves to its
  own before it is committed.
- **Work found in a checkout that is not its own** (the person, 2026-11-16). Several sessions work at once, each in its
  own worktree (`git worktree list`). Files changed or new in a checkout, outside the feature it is on, are someone
  else's: never commit them there. Compare each with its folder's branch (`feature/<folder>`), by blob:
  `git rev-parse -q --verify <branch>:<path>`. Identical: they are left-over copies, and may be cleared once checked.
  Not on that branch: move them to it (in its worktree if it has one, never by switching that worktree's branch), or to
  a new `feature/<folder>` from `main` if none exists. Say what was found, and where it went.
- **Every core action is reachable from a `wb` command.** When wb-core gains an action, `wb` gains a command for it, so the
  person (or an AI) can do from a terminal anything the window does.

## Layout

| Path | What |
|---|---|
| `crates/wb-core` | Everything that is not drawing: `bible` (read-only SQLite), `places` (references), `lookup`, `scripture`, `anchors`, `store` (the study files), `studyapi`, `reading` (plans and progress), `cache`, `marks`, `views`, `commands` (the command language), `notebook` (journal, inbox, placing), `pages` (pages inside pages, Pinned, a page's blocks, thread and word blocks), `concordance` (the printed Strong's as a book: the English page, an entry's places, the box, the letter strip and its two settings), `threadpage` (today a thread file shown as a page; threads TH-1 reads it as a folder with a color), `margin` (margin notes in `margin/<BOOK>/<chapter>.md`, the verse's margin, Grow into a page), `pageindex` (which pages name which verses, in memory, one page at a time), `pencil` (the pencil's lines), `overview` (Scripture in this page), `questions` (questions written in a page, and the one list of them), `check` (the read-only check of the folder), `relay` (`wb do`), `docs` (documents from a thread, that is a folder with a color, or a page: the plans, the Word writer, the PDF deck through Typst, `documents/` records; its fonts in `crates/wb-core/fonts`) |
| `crates/wb-cli` | The `wb` command table (a library the app runs in-process) and the `wb` binary |
| `app/src-tauri` | The Tauri 2 shell: commands that call wb-core |
| `ui/` | The UI: TypeScript, CSS, fonts (Literata for scripture, Inter for the interface), `tokens.css` from the design tokens |
| `spikes/` | Phase 0 experiments (git sync, Typst PDF), kept for reference |
| `design/features/` | One folder per feature being designed: dated decisions, open questions, FigCraft script, sheets, and what the build must satisfy ([index](design/features/README.md), `_template/` for a new one); the shared FigCraft helpers stay in `design/` |
| `docs/` | Current spec and archived evidence |

## Commands

```
cargo build                                  # the workspace
cargo run -p wb-cli -- text "Num 25:11"      # verbatim scripture
cargo test                                   # the Rust regression suite
npm install && npm run tauri dev             # the app (from the repo root)
npm run package                              # the buyer's ZIP (BUYER-README.md ships as README.md); npm run check:package checks it
npm run test:webkit                          # the UI in Playwright's WebKit at phone size (this checkout's own vite, on its own port)
node measure/desk.mjs                        # the desktop checked in the real app (its own instance and scratch copy)
npm run measure                              # the speed budgets (after npx tauri build --no-bundle)
python scripts/build-dictionary.py           # Webster's 1913 into dictionary.db (wb word-define, the card's Definitions); once per computer
powershell -File scripts\backup-study.ps1   # a hashed copy of the real study folder (reads it only), before the app uses it
powershell -File scripts\install-app.ps1    # the release build into %LOCALAPPDATA%\bible-workbench-rs\app (refuses while it is open)
```

Preserve established `wb` command contracts unless the change calls for a deliberate improvement. Verify changes with
Rust tests. The comparisons with the Python app (`scripts/golden.py`, `scripts/doc-plans.py`, `scripts/py-opens.py`,
`scripts/commands-cases.mjs`, `tests/golden/cases.json`) are history: run them only to learn how something used to
behave, never as a test this app must pass.

Every `measure/*.mjs` script that starts the real app first takes a machine-wide lock (`measure/instance.mjs`, a file in the temp folder)
and gets a free debugging port, so sessions in different checkouts wait their turn instead of colliding or piling up windows; a dead
run's lock is taken over. A script that starts the real app must call `await acquire('<name>')` before it touches its work folder.

`npm run dev` (and `npm run tauri dev`) serve the UI on 1420, which Tauri's `devUrl` expects. `npm run test:webkit` never
uses that server: Playwright starts this checkout's own vite on a port picked from the checkout's path (1430-1929;
`WB_UI_PORT` sets it by hand) and never reuses a running one, so a worktree's tests always test that worktree's UI. If the
port is taken, the run stops with "is already used" instead of testing another checkout. A new worktree needs
`npm install` and `npm run fixtures` before the tests.

On the distribution checkout, documents (Word files, PDF slides) go to `WB_DOCS_DIR`; with the person's real study folder, to
Documents\Bible Workbench, where the person's documents already are; with any other study folder, to a folder beside it
(`<study>-documents`), so tests and scratch copies never write the person's documents. After a document is made, every
verse the source holds is checked in the finished file; one that fails is not kept.

Do not push without the person's go-ahead.
