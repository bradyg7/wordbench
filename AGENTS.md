# Working on Bible Workbench (Rust) — for an AI assistant

This app (`bible-workbench-rs`) is the Bible Workbench. The Python app in the sibling `bible-workbench` checkout is its
predecessor and no longer a constraint (the person, 2026-11-12): it is only a source of history and of the Bible
database. When a change alters expected behavior, document the contract and verify it with Rust-owned tests.

## Read before you start

- **Designing or deciding:** [the principles](design/features/principles/README.md) (goals, the frame, every standing
  decision), then [the Library map](design/LIBRARY.md): the app's objects, their words and the priority list. A design
  that needs a new object or word changes the map first, with the person's go-ahead.
- **Designing, cutting tickets, building or reviewing:** [how work is done](docs/agents/how-work-is-done.md) (who does
  what, the interaction table and review deck, tickets, handoffs, approvals).
- **Writing or reviewing code:** [CODING_STANDARDS.md](CODING_STANDARDS.md), and for anything the person sees
  [DESIGN_STANDARDS.md](DESIGN_STANDARDS.md).
- **Touching study files, documents or the database:** [the study folder](docs/agents/study-folder.md).
- **Running the app, tests or a release:** [commands, ports and releases](docs/agents/commands.md).
- **Words:** `design/LIBRARY.md` (app words) and `GLOSSARY.md` (development words); see `docs/agents/domain.md`.
  Work is tracked in design folders and their tables, not GitHub Issues (`docs/agents/issue-tracker.md`).
- **The turnaround** (2026-11-23): [docs/turnaround.md](docs/turnaround.md) is followed in order; new ideas go to
  [its parking lot](docs/turnaround-parked.md).

## Rules that never change

- **Scripture is verbatim, with its reference.** Fetch every verse from the database (`wb text "Num 25:11"`) or
  generate it: in code, tests, fixtures, docs, notes and documents alike. Fixtures that hold scripture are generated.
- **No interpretation.** The app shows source text, the person's own notes and lookups. Doctrinal questions are the
  person's, not the tool's.
- **The study folder is the person's real work.** Tests, spikes and experiments use a scratch copy:
  `scripts/scratch-study.ps1` copies it to `%TEMP%\bible-workbench-rs\study-scratch`, and `WB_STUDY_DIR` points the app
  and `wb` there. wb-core refuses the real folders (`github\bible-study-data`, `Documents\wordbench-study-data`, the
  folder the installed app's settings name, and anything inside them) unless `WB_ALLOW_REAL_STUDY=1`, which nothing in
  this repo sets. Only an installed release (the `installed` feature, built by the release workflow alone) opens the
  folder the person chooses (2026-11-18).
- **What the person wrote is never lost.** The study folder's formats are this app's to shape; a format change reads the
  old form, and moving the person's files happens once, designed, tried on a scratch copy, after a hashed backup, with
  the person's go-ahead ([details](docs/agents/study-folder.md)).
- **Everything is a page, in the window** (2026-11-09), and **a thread is a folder with a color** (2026-11-17).
- **The Bible database is read-only.** It is opened with SQLite's read-only flag.
- **Never lose the reader's place.** Anything opened from the text returns to the verse it came from.
- **Designed before it is built** (2026-11-11). Every feature, button and command the person would see has a design
  folder under `design/features/` (dated decisions, frames, the interaction table, "what the build must satisfy")
  before it is built or changed. Building starts only from a folder the person marked *accepted*.
  [`coverage.md`](design/features/coverage.md) lists every area and its folder; a new button or command gets a row
  there first. Bug fixes that keep the accepted design need no new round.
- **Two clones, one feature at a time** (the person, 2026-11-23). `C:\Users\brady\github\wordbench-workspaces\Main`
  holds all code work, one branch at a time: `feature/<folder>` from an up-to-date `main` for an accepted design, and
  nothing else on it; `fix/<what>` for a fix. It reaches `main` after CI passes, with the person's go-ahead.
  `...\Design` holds designing with the person and never changes existing code: it starts from an up-to-date `main`,
  moves onto the new `main` after every merge, and designs at most the next feature. A prototype there reads the app's
  code and adds only its own files; one that leans on code the current build is changing waits for that merge. No other
  clone or worktree. Files found changed that are not this branch's stay out of its commits: say what they are and ask.
- **Shipped means it is in the person's installed app** (2026-11-18): a release installed through the updater, not a
  merge ([how to release](docs/agents/commands.md#a-release)).
- **Every core action is reachable from a `wb` command**, so the person (or an AI) can do from a terminal anything the
  window does.
- **Push, tag and release only with the person's go-ahead**, each time.

## Layout

| Path | What |
|---|---|
| `crates/wb-core` | Everything that is not drawing: the Bible, places, the study files, pages, marks, documents (find a module with `codegraph_explore`) |
| `crates/wb-cli` | The `wb` command table (a library the app runs in-process) and the `wb` binary |
| `app/src-tauri` | The Tauri 2 shell: commands that call wb-core |
| `ui/` | The UI: TypeScript, CSS, fonts, `tokens.css` from the design tokens |
| `design/features/` | One folder per feature ([index](design/features/README.md), `_template/` for a new one) |
| `docs/` | Process, the turnaround, releases and archived evidence |
| `spikes/` | Phase 0 experiments, kept for reference |
