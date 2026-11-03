# Phase 2: the desktop — results

2026-11-02. Phase 2 of [PLAN.md](PLAN.md), section 8: the Large and Expanded layouts around the phase 0 reader, the
command field, the dock of panes, the Notebook, threads and layers, search and word study, lexicons and the interlinear,
find, text size, the keyboard and `wb do`. Built against the scratch study folder. **The phase 2 check (a week of daily
study without the Python app) started on 2026-11-02 on the real folder**, on the person's go-ahead (section 9).

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs`: **31 of 31** checks, in WebView2, at 1440×900 and the other sizes |
| WebKit (the iPhone and iPad engine) | `npm run test:webkit`: **12 of 12** (the 10 of phase 0 and 2 for the new shell) |
| Rust tests | `cargo test`: **105** (97 before; 4 for the Notebook's `wb` commands, 4 for the command language) |
| The command language against the Python parser | **480 of 480** lines and **108 of 108** texts with references give the same answer |
| Golden suite (the Rust `wb` against the Python `wb`) | **99 of 99** the same (`python scripts/golden.py`) |
| Speed budgets | **All met** at 4× CPU slowdown (section 7); Psalm 119 scrolling down to one long frame of 34 ms |

Screenshots of the app itself are in [phase2/](phase2/): [the reader with the Notebook](phase2/1440-reader-with-the-notebook.png),
[the command field](phase2/1440-command-field-open.png), [word study and the interlinear](phase2/1440-word-study-and-interlinear.png),
[placing a note](phase2/1440-placing-a-note.png), [a thread](phase2/1440-a-thread.png), [a floating pane](phase2/1440-a-floating-pane.png), and the size classes
([laptop](phase2/laptop-expanded.png), [iPad portrait](phase2/ipad-medium.png), [phone](phase2/phone-compact.png)).

## 1. One set of actions: `wb` in-process

`crates/wb-cli` is now a library (the command table, `run`, `run_value`) and a small binary. A command gets the Bible and
the study folder from a `Ctx`: a `wb` run opens its own; the window lends its long-lived ones (`Ctx::lent`). The app has
one IPC command, `wb(argv, input)`, which runs the same table in-process and returns `{json}` or `{text}`. Every pane,
every write and the command field go through it, so the window can do nothing a terminal cannot (CLAUDE.md), and both
give the same answer. `-` (standard input) is the text sent along with the call. Argument errors return their argparse
message instead of exiting.

## 2. The desktop shell (`ui/`)

- **Toolbar** (one row, as on the sheets): ‹ the place picker › (book grid, then chapters), the merged command field,
  Notebook (with the Inbox count), Threads, Shelf (hidden below 1366 px), Highlights ▾ (layers), More ⋯.
- **The reader** is phase 0's, unchanged in how it draws and handles touch. New: a ? on the verse number of an open
  question, text size, find in the chapter, and layers.
- **The dock** (`ui/src/dock.ts`): tabbed columns beside the reader. Large (≥ 1440): study panes on the left, the
  Notebook and threads on the right. Expanded and Medium: one column on the right. Compact: no columns; the pane in front
  is a full screen with "Back to Numbers 25:11". Columns minimize to a tab at the edge; any pane can float (dragged by
  its tab strip, resized from its corner; where and how big it is are kept). A tab dragged over the reader floats its
  pane; dragged to an edge, it docks in that column (the zone it would go to is shown while dragging).
  **dockview-core was not used**: the layouts on the sheets need fixed columns
  with tabs, not free tiling, and a phone needs the pane as a screen; about 250 lines did that, with no dependency and
  nothing to style against.
- **Never lose the place:** opening, closing and moving panes, resizing the window, crossing a size class and changing
  the text size all keep the verse at the top of the reader at the top (checked at Psalm 119:50 through every size). A
  jump (`go`, a reference clicked in a note, `first`/`last`, a plan's day) keeps the place left for `back` (Alt+←).
- **Size classes** follow PLAN.md section 3 live, from the window's width. The phone layout of phase 0 is unchanged.

## 3. The command language in wb-core

`wb-core::commands` is the Python app's `web/commands.js`, parsed once in Rust and returned as a typed `Action` (an enum;
it serializes as the Python parser's object did). `scripts/commands-cases.mjs` runs the Python parser itself on every
line its tests and its manual give it and on every text its reference tests use, and the Rust tests compare: 480 lines,
108 texts, all the same. The manual (`web/help-docs.js`) is copied into wb-core the same way, so `help` in the window,
`wb manual` and the manual's lookups are one.

The field and `wb do` both run a line the same way: `wb parse` → the action → the window does it (`ui/src/actions.ts`)
→ a sentence saying what it did, which is also written to the day's log as the Python app did.

New in the language: `jot <text>` (`jot ?…` for a question), `place <part of an Inbox note> @John 3:16`, `journal [day]`,
`inbox`, `notebook`, and `window phone|ipad|laptop|…` (PLAN.md section 7).

New `wb` commands: `wb parse`, `wb manual`, `wb refs`, `wb do`.

## 4. Panes

Search (ticks, "Add to a thread…", pages), every use / first / last (the both / original / English marks), word study
(`def`, the Strong's entry with its renderings and a count by book, BDB, `forms`, `count`, `lexiconc`, `near`), the
interlinear (right to left for Hebrew, each word's Strong's number opens its entry; Alt+click a word opens its verse),
passages (`open`, `compare` with the YLT under each verse, several places), the threads list (with an eye per thread)
and a thread (drag to reorder, which writes the whole order as `wb thread order` does; take a place out; rename, note,
color, sort, delete), find in your own notes, marked, the day's log (a line can be run again), Help (the manual, with
each example runnable), Keys, the Shelf (sets), a lesson's text, and notes on a place.

The verse popover, the word sheet and the selection bar now write: Note, Question and Thread (a chooser with a new name)
go through `wb note add`, `wb trail add` and `wb thread add`; colors as before through the no-overlap rule; Every use and
Interlinear open their panes.

## 5. The Notebook

Docked on the right at desktop sizes (PLAN-design.md section 3; the sheets' "1440 reader with the Notebook" and "1280
placing a note"):

- **Journal:** every note by the day it was written (local days), newest first: placed notes, Inbox notes and
  questions. "? Questions only" narrows it. The writing box sits at the bottom: Enter adds, Shift+Enter is a new line.
  It writes with no place (into the Inbox) unless a place is chosen; a place clicked in the reader is offered, already
  on, and a click takes it off. "? Question" makes it a question.
- **Inbox:** notes with no place yet, newest first. **Place it…** offers the place selected in the reader, then the
  place the note's text names (`find_refs`), then any place typed. "Ask it as a question" turns a note into one.
- **All notes:** placed notes in Bible order by book (notes on a Strong's number everywhere last), with a filter.
- References in a note's text are links (wb-core's `find_refs`, the same rules as the Python app's); with a mouse, a
  hover shows the verse, verbatim.
- An Inbox note can be dragged onto a verse in the reader to place it there (PLAN-design.md's second Notebook step).
- Each entry: edit in place, mark a question answered or open again, delete (to `.trash/`).

**The files** (the decision in PLAN-design.md that keeps it safe): an unplaced note is its own Markdown file in
`notes/_inbox/`, with the notes' front matter and an empty `anchor` (kind `jot` or `question`). The Python app passes
over it, as it passes over any note without an anchor, so nothing it shows changes; the Rust store keeps Inbox notes
in a list of their own, so the reader's marks, note lists, threads, `find` and documents see only placed notes. Placing
writes the note at its place (`notes/<BOOK>/<id>.md`, or `notes/_words/` for a Strong's number) and only then removes the
Inbox file; a question becomes a trail (`trails/<id>.md`, status open), so the Python app shows it with its other
trails. The id and the day it was written are kept. Checked: the Python `wb` lists a placed question and a placed note
made by the Rust app.

**Questions:** existing trails are read as questions, as decided in review. A question at a place is a trail, as `?` in
the box always made; one with no place waits in the Inbox.

**Commands:** `wb note jot`, `wb note place`, `wb note all`, `wb journal`, `wb inbox`, `wb inbox edit`, `wb inbox rm`,
`wb questions`.

## 6. `wb do`

The app listens on a loopback port the system picks and writes `{port, token, pid, study}` to `app.json` in the cache
folder. `wb do "open John 3:16-18"` sends the line with the token; the window runs it as if typed and answers with what
it did, which `wb do` prints (`--wait` seconds, default 10; several lines with `--each` or `-`). Only this computer can
connect, and only with the token from that file. Checked in the desktop run: the passage opened in the window, verbatim.
A second app instance takes over `app.json` (the newest window answers).

## 7. Speed budgets

Release build, phone window, the web view's CPU slowed 4× (as PLAN.md section 6 asks), on the touchscreen laptop with
the watch window open beside it. Raw numbers: [phase2/measured.json](phase2/measured.json). `npm run measure`.

| Budget | Phase 0 | Phase 2 | |
|---|---|---|---|
| Cold start to the last place < 1.5 s | 677 ms | **719 ms** (5 launches, 699–731) | Met |
| A chapter drawn < 100 ms | 80–89 ms (Psalm 119: 87) | **60–91 ms** (Psalm 119: 91; complete after 248 ms) | Met |
| A tap card < 100 ms | word 62, verse 43 | **word 55** (max 72), **verse 41** | Met |
| Hover card | 33 ms | **24 ms** | Fine |
| Plain search < 50 ms | not measured | **8 ms** for the results (Rust 1.2 ms); **38 ms** from Enter to the results drawn in their pane | Met |
| No frame drops scrolling Psalm 119 with layers on | 5 long frames (worst 384 ms) | **1 long frame** of 811 (34 ms) | Nearly met |
| Long press and drag (touch through WebView2) | 7:2–8:3, 0 px scrolled | the same | Works |
| Memory (private) | Rust 6 MB, web view ~198 MB | Rust ~21 MB, all processes 220 MB | The Rust process now holds the search index in memory |
| Size | 11.5 MB | **16.5 MB** | The `wb` command table is inside the app |

Two changes got search under the budget: long lists draw a screenful first and the rest between frames (as the reader
draws a chapter), and a line the command field has already parsed for its suggestions is not parsed again on Enter.
Measuring needed one fix: a measured instance gets its own web view profile, since WebView2 refuses to start a second
process on the watch window's profile with different options. A first full run overlapped the golden suite and gave
noisy numbers (word sheet 110 ms); on a quiet machine it was 46–55 ms in three runs.

## 8. Deliberate differences and notes

- **A scope may be book ids** (`--scope 40,41,42,43`), as the window passes a group on. The Python `wb` refuses those, so
  no answer the two share changed.
- **The Notebook and the questions are new**; the Python app does not show Inbox notes (they have no place), and shows
  placed ones as ordinary notes and trails.
- **Layouts** saved by the window (`layout save`) describe the Rust window's panes; the Python app's dockview layouts
  are not read (`layout load` says so).
- **Later phases** answer with a sentence instead of doing nothing: documents, PDFs, `doc`, `deck`, `lesson build`,
  `theme`, `packet` (phase 5), `listen` (phase 6), opening a set's panes (phase 6).
- Tauri needed a capability file (`app/src-tauri/capabilities/default.json`, `core:default`) for the window to listen
  for `wb do`'s events.

## 9. The phase 2 check: started

PLAN.md: *a week of daily study on the desktop without opening the Python app.*

**Started 2026-11-02, about 23:15, on the person's go-ahead** ("Yes, use the real folder"). Before the app opened it:

- The real folder was copied by `scripts/backup-study.ps1`, which only reads the folder and compares every copy with
  its original by hash: 101 files, all the same, in
  `%LOCALAPPDATA%\bible-workbench-rs\backups\bible-study-data-20261102-231033`. (A first copy made from this session's
  own shell did not count: that shell's writes outside the repository stay in its sandbox. The script was run in the
  person's terminal.)
- The release app (built from e0a5410) was copied out of `target/` to `%LOCALAPPDATA%\bible-workbench-rs\app\`, so a
  later build neither replaces it mid-week nor fails on its locked file. `wb.exe` is beside it.
- `wb status` with the go-ahead found the folder: 23 notes, 3 threads, 8 questions. Without it, wb-core still refuses.
- The scratch watch window was closed, so one Bible Workbench window is open and `wb do` reaches it. The app announced
  the real folder; nothing in the folder had changed when it opened.

How it is started, typed in a terminal (**nothing in this repository sets `WB_ALLOW_REAL_STUDY`**, as CLAUDE.md asks):

```
$env:WB_STUDY_DIR = 'C:\Users\brady\github\bible-study-data'; $env:WB_ALLOW_REAL_STUDY = '1'; $env:WB_WINDOW = 'laptop-large'; & "$env:LOCALAPPDATA\bible-workbench-rs\app\bible-workbench.exe"
```

`wb` on the real folder, from that same terminal: `& "$env:LOCALAPPDATA\bible-workbench-rs\app\wb.exe" journal`.

What the week writes, in the Python app's formats: notes, highlights, threads and trails as before; notes with no place
in `notes/_inbox/` (the one new folder); each command-field line in `sessions/<day>.jsonl`, as the Python app logs them.
The Python app can still open the folder at any time. If anything goes wrong, the backup above is the folder as it was.

To report at the end of the week: what was missed from the Python app, what got in the way, and anything that looked
wrong in the files.

The scratch copy still works for trying things out: `powershell -ExecutionPolicy Bypass -File scripts\watch-app.ps1`.
To try a feature: open the Notebook and write a thought (Enter); place it from the Inbox; press backtick and type
`uses zeal gospels`, `def H7065`, `interlinear Num 25:11`, `+Phinehas`, `thread Phinehas`; turn chapters with ← →; Ctrl+F;
Ctrl+= and Ctrl+-; make the window narrower; from a terminal, `wb do "open John 3:16-18"`.
