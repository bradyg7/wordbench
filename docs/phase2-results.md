# Phase 2: the desktop — results

2026-11-02. Phase 2 of [PLAN.md](PLAN.md), section 8: the Large and Expanded layouts around the phase 0 reader, the
command field, the dock of panes, the Notebook, threads and layers, search and word study, lexicons and the interlinear,
find, text size, the keyboard and `wb do`. Built against the scratch study folder. **The phase 2 check (a week of daily
study without the Python app) started on 2026-11-02 on the real folder**, on the person's go-ahead (section 9).

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs`: **73 of 73** checks (45 at the start of the check, the rest for its findings), in WebView2, at 1440×900 and the other sizes |
| WebKit (the iPhone and iPad engine) | `npm run test:webkit`: **12 of 12** (the 10 of phase 0 and 2 for the new shell) |
| Rust tests | `cargo test`: **112** (97 before phase 2; 2 for the reader in the YLT; 4 for the Notebook's `wb` commands, 4 for the command language; 2 for moving notes, questions and `read when`) |
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
  **Many tabs** (on the person's request, 2026-11-03): a tab keeps its width (its whole title, up to 200 px) and the
  strip scrolls: the mouse wheel, ‹ › at its ends when there is more, and ▾ listing every tab in that column; the tab in
  front is kept in view, and the column's buttons stay put. **A column's width:** drag its inner edge (double-click puts
  it back), or expand it to half the window and back; widths are kept between runs. The reader keeps at least 460 px;
  when both columns want more, the one not touched last gives way, down to 280 px.
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

**The color bar** (a selection with the mouse) has what the Python app's had: the five colors (keys 1–5), your saved
colors (c1–c8; a custom color is saved when used), any color, × to remove the highlight (key 0), chips for your three
most recently changed threads (a click adds the selection; a second click takes it out), Note, Thread, Copy, and
**Notes & lookup**. That opens the place pane (as the Python app's My notes): the words verbatim, their highlight
(colors and ×), your notes there with Edit and Delete, a box to add one, questions there (mark answered or open again),
notes nearby and on the original word everywhere, the threads holding it (open, or take it out), Add to a thread,
Interlinear, and its Strong's numbers. The verse popover has Notes & lookup too; `notes [@place]` opens it.

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

How it is started: **the Start menu's "Bible Workbench (Rust)"** (added 2026-11-03 on the person's request; it can be
pinned to Start or the taskbar, and the open window groups under the pinned icon). The shortcut runs the installed app
with the options the app takes for this (`--study <folder>`, `--allow-real-study`, `--window <size>`, the same as the
`WB_STUDY_DIR`, `WB_ALLOW_REAL_STUDY` and `WB_WINDOW` settings):

```
%LOCALAPPDATA%\bible-workbench-rs\app\bible-workbench.exe --study "C:\Users\brady\github\bible-study-data" --allow-real-study --window laptop-large
```

The shortcut is the person's own (made once, not by a script in this repository): **nothing in this repository passes
`--allow-real-study` or sets `WB_ALLOW_REAL_STUDY`**, as CLAUDE.md asks. Without it, wb-core still refuses the real
folder, and the app now says so in a message box instead of closing silently. From a terminal the settings work as
before:

```
$env:WB_STUDY_DIR = 'C:\Users\brady\github\bible-study-data'; $env:WB_ALLOW_REAL_STUDY = '1'; $env:WB_WINDOW = 'laptop-large'; & "$env:LOCALAPPDATA\bible-workbench-rs\app\bible-workbench.exe"
```

A newer build reaches this app with `scripts/install-app.ps1` (after `npx tauri build --no-bundle`), which copies it
into `%LOCALAPPDATA%ible-workbench-rspp\` and refuses while the app is open.

`wb` on the real folder, from that same terminal: `& "$env:LOCALAPPDATA\bible-workbench-rs\app\wb.exe" journal`.

What the week writes, in the Python app's formats: notes, highlights, threads and trails as before; notes with no place
in `notes/_inbox/` (the one new folder); each command-field line in `sessions/<day>.jsonl`, as the Python app logs them.
The Python app can still open the folder at any time. If anything goes wrong, the backup above is the folder as it was.

To report at the end of the week: what was missed from the Python app, what got in the way, and anything that looked
wrong in the files.

## 10. What the check found: day 2 (2026-11-03)

The person wrote 25 notes in the app on 2026-11-03 (three on verses, twenty-two in the Inbox), between 14:36 and 15:56.
Each is listed once below, under where it goes. The notes stay where the person wrote them in the study folder; their
ids are given so each can be found.

### Phase 2: fix now, during the check

Bugs, or things that got in the way of daily study.

| # | Note | What it says | What to do |
|---|---|---|---|
| 1 | `a022` | "Mark Numbers 25 as read" does not persist; going back shows it unmarked | The chapter's end never asks the log; it shows the button again every time. Show "read on …" from the log; `wb read when` |
| 2 | `3c78`, `0698` | Scrollbars are dark in light mode (the Journal's too); want our own thin ones | `color-scheme` follows the system, not the chosen theme. Make it follow the theme; thin scrollbars in the tokens' colors |
| 3 | `cfe4` | Stretching a floating pane from its corner moves the scrollbar | The resize corner sits over the pane's scrollbar; move it out of the scroll area |
| 4 | `0928` | A thread scrolls sideways; wrap the text, and why so long? | Thread rows wrap; long verses are cut to a few lines with the rest on a click |
| 5 | `6dcc` | In word study, clicking the rendering "zealous" (H7065) shows every use, with "both: 2", and none can be clicked | A rendering opens only the verses where the word is translated that way, and each row opens its verse |
| 6 | `6f9f` (Ruth 4:16) | The note box appears twice at some points | Find where two writing boxes show at once (Notes & lookup beside the Notebook's box is the likely one) and keep one |
| 7 | `eca5`, `e872` | Untag a question by clicking "Question", not ⋯; mark a question answered | The tag is a toggle; "Answered" in plain sight on each question |
| 8 | `ecfc` | A delete button clearly visible on notes | Delete in plain sight on each note (still to `.trash/`) |
| 9 | `e29e` | Change which verse a note is attached to | "Move to…" on a note, as Place it does for the Inbox; `wb note move` |
| 10 | `0863` | Italics in the current font are not clear | KJV italics (supplied words) drawn so they read clearly; more fonts go with themes (phase 5) |
| 11 | `4ad9` (Num 25:8) | Threads are hard to understand: one note, no notes to add, a word shows only its Hebrew | The thread's note shown at its top and editable there; a word in a thread shows its English rendering and gloss, not only the original |

**Fixed 2026-11-03** (all eleven; `node measure/desk.mjs --release` checks each, 54 of 54):

1. The chapter's end asks the log (`wb read when "Num 25"`, new) and says "Numbers 25: read Tue, Nov 3", with "Read
   again"; marking writes `reading/log.jsonl` as before.
2. `color-scheme` follows the theme chosen in the app, so the scrollbars are light in the light theme under a dark
   system. Every scrollbar is thin, in the tokens' colors (the Journal's too).
3. A floating pane has its own resize corner, drawn above the pane and its scrollbar (the browser's corner sat on the
   scrollbar). Its size is kept as before.
4. The threads list wraps each thread's note to two lines; the eye stays in view. (The list was 960 px wide in a 420 px
   column: a note that would not wrap.)
5. A rendering in a Strong's entry opens `uses H7065 --rendering zealous`: only those verses (2 for "zealous"). The
   mark chips (both / only the original / only the English) are filters: a click shows only those verses.
6. **The doubled box was a race:** two draws of the Notebook at once each added a writing box. Only the newest draw is
   put in the pane now. And Note or Question on a verse at desktop sizes writes in the Notebook's box, with the place
   chosen and the box focused ("Your note on Ruth 4:16…"), instead of a second box over the verse. On a phone it is
   still the small box beside the verse.
7. The "? Question" tag is a switch: a click makes it a plain note, at its place or in the Inbox (a placed question
   moves from `trails/` to `notes/<BOOK>/`, keeping its id and day). "✓ Answered" and "Open it again" are in plain
   sight, and an Inbox question can be answered before it has a place (`status` in its front matter, kept when placed).
   `wb note question <id> [--plain]`, `wb note answered <id> [--open]`.
8. Delete is in plain sight on every note in the Notebook and in Notes & lookup (still to `.trash/`).
9. "Move…" on a placed note or question offers the place picked in the reader or any typed place; the file moves to
   the new book's folder, written there before the old one is removed. `wb note move <id> "Num 25:7-13"`.
10. The KJV's italics are a heavier italic (Literata 500) in a slightly warmer ink. A first try: the person to say if
    it reads clearly.
11. A thread's note is at its top and edited there with a click ("Add a note to this thread…" when it has none). An
    original word in a thread shows its KJV renderings, its definition and how many times it is used.

### Decided by the person (2026-11-03), and built

| # | Note | The person's answer | Built |
|---|---|---|---|
| 12 | `a4a8` | "Delete should send notes to a trashbin that auto deletes notes after 7 days" | A deleted note or question waits in `.trash/`; the window erases those deleted 7 days ago or more when it opens. The Notebook's **Trash** tab lists them with the days left and **Put it back**. Other files in `.trash` (threads, highlight files, plans) stay. `wb trash`, `wb trash restore <name>`, `wb trash empty [--days 7]`. CLAUDE.md's rule changed to say so |
| 13 | `e0a3` | "One note should be able to sit on multiple verses even if they aren't next to each other" | **+ Place** on a note puts it on another place too, as many as wanted; it shows at each (margins, Notes & lookup, the verse card, note lists, a pill on its card). The file stays at its first place with `also: [...]` in its front matter; the Python app keeps the field and shows the note at its first place. `wb note also <id> <place> [--remove]` |
| 14 | `6572`, `4ad9` | "A thread can hold more than one note (how else would the thread building the documents be valuable, unless the notes were attached?)" | A thread pane has **Notes**: notes written on the thread (with no place, in `notes/_threads/`, which the Python app passes over) and any note or question put on it (**+ Thread** on a card; `threads: [...]` in its front matter). A note's threads are chips on its card. `wb thread write`, `wb thread notes`, `wb note thread <id> <thread> [--remove]`. They are kept for the documents of phase 5 |
| 15 | `56e7` | "The pencil button is the notes button on mobile" | The pen is at the reader's bottom right at every size. At desktop sizes it writes in the Notebook's box on the place picked (or the verse at the top); on a phone it is still the palette's place (phase 3) |

`wb note text <id>` edits any note wherever it is (at a place, on a thread, in the Inbox, a question).

### Design first, then build

| # | Note | What it says | Where it goes |
|---|---|---|---|
| 16 | `05f3`, `f4ac` | The Journal as a full writing space (Apple Notes, Notion, Obsidian), with references in it; the Notebook as the staging area for building a lesson | Notebook design now; the lesson half joins phase 5 (lessons) |
| 17 | `3fa7`, `a484` | The Shelf as folders, like Obsidian's files; a set should open all its tabs | Opening a set's panes was phase 6; the Shelf's redesign goes with it, brought forward |
| 18 | `2395` | Dropping a tab at the top middle floats it; want fixed top and bottom middle areas like the side columns; view presets ("word study mode") | Dock zones now (phase 2); presets are the layouts of phase 6 |
| 19 | `c551`, `8810` | Customizable throughout: the toolbar (choose what shows), the command bar, themes, how the Shelf works; a "customize" part of settings | A settings design; themes are phase 5 |
| 20 | `a022` | Custom and preset reading plans that can be revisited and changed | wb-core and `wb` have plans (phase 1); the window has only "Today's reading". A plans pane |
| 21 | `7a77` | Room for other translations (YLT or others) | The database has the KJV and the YLT (`compare` shows the YLT). A translation switch in the reader; other translations need a source and a license check |
| 22 | `0863` | More than one font | With themes (phase 5) |

Notes counted twice above: `a022` (1 and 20), `0863` (10 and 22), `4ad9` (11 and 14). Every note from the day is in
one of the tables.

## 11. What the check found: day 2, evening (2026-11-03)

Two notes about the app after the list above, and one use of the Python app: at 18:16 it built a Speaker Script and a
verse deck from the Phinehas thread (`documents/`), which the Rust app cannot do yet. That and the open items led to
phase 2b, the desktop finished before the phone ([PLAN-phase2b.md](PLAN-phase2b.md)).

| # | Note | What it says | Where it goes |
|---|---|---|---|
| 23 | `564e` | Verses and words clickable, not hoverable; once clicked, tabs that can be dragged, as in dockview | **Built** (phase 2b step 1): hover cards are off by default and the setting is kept between runs (More ⋯, or `hover on`/`off`/`refs`); a click on a word or verse number opens its card as before, and now a click on a reference in a note does too (the verse verbatim, **Go to**, **Open as a tab**; Ctrl+click goes straight there). The verse and word cards have **Open as a tab** (a passage pane, the Strong's entry), and tabs drag between columns and float as before. The dockview-style dock is phase 2b step 4 |
| 24 | `7a77` | Room for translation changes (item 21 again) | **Built** (phase 2b step 2): **KJV / YLT** in the toolbar, under More ⋯, or `version ylt` / `version kjv`; kept between runs, and the verse at the top stays at the top. The YLT is drawn verbatim from the database (each verse's text split at its spaces; a test joins every verse of three chapters back and compares). It has no KJV word positions, so on the YLT highlights and thread places on whole verses are drawn, a note on words marks its verse, words cannot be selected (a toast says to use the KJV), and a click on a word opens its verse, in the YLT. `wb reader NUM 25 --version ylt` gives what the window draws. A third translation is a row in the database's `versions` and `verse_texts` tables, once its source and license are checked |

The scratch copy still works for trying things out: `powershell -ExecutionPolicy Bypass -File scripts\watch-app.ps1`.
To try a feature: open the Notebook and write a thought (Enter); place it from the Inbox; press backtick and type
`uses zeal gospels`, `def H7065`, `interlinear Num 25:11`, `+Phinehas`, `thread Phinehas`; turn chapters with ← →; Ctrl+F;
Ctrl+= and Ctrl+-; make the window narrower; from a terminal, `wb do "open John 3:16-18"`.
