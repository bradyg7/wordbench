# Phase 2: the desktop — results

2026-11-02. Phase 2 of [PLAN.md](PLAN.md), section 8: the Large and Expanded layouts around the phase 0 reader, the
command field, the dock of panes, the Notebook, threads and layers, search and word study, lexicons and the interlinear,
find, text size, the keyboard and `wb do`. Built against the scratch study folder. **The phase 2 check (a week of daily
study without the Python app) started on 2026-11-02 on the real folder**, on the person's go-ahead (section 9).

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs`: **81 of 81** checks (45 at the start of the check, the rest for its findings), in WebView2, at 1440×900 and the other sizes |
| WebKit (the iPhone and iPad engine) | `npm run test:webkit`: **12 of 12** (the 10 of phase 0 and 2 for the new shell) |
| Rust tests | `cargo test`: **114** (97 before phase 2; 2 for changing reading plans; 2 for the reader in the YLT; 4 for the Notebook's `wb` commands, 4 for the command language; 2 for moving notes, questions and `read when`) |
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
into `%LOCALAPPDATA%\bible-workbench-rs\app\` and refuses while the app is open.

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
| 20 | `a022` | Custom and preset reading plans that can be revisited and changed | **Built** (phase 2b step 3, 2026-11-04): the **Reading plans** pane (More ⋯, or `plans`). Each plan: where you are (day, done, to catch up, ahead), today's readings with **Mark read**, every day with its date and a ✓, and changes: **Catch up** (today becomes the first day not read), **Spread the rest…** (what is not read, over N days from today), **Rename…**, **Start day…**, **Edit as text…** (one day to a line), **Stop**. Each change keeps the plan as it was in `.trash/`; a day counts as done by what the log shows read, so a change never loses what was read. **Start a plan** (a built-in kind, with the days previewed first) and **A plan of your own** (one day to a line). **What you have read**: chapters read at least once, by book. New `wb plan edit` (`--rename`, `--start`, `--catch-up`, `--days`, `--text`) and `wb plan text` |
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

## 12. What the check found: day 3 (2026-11-04)

Fifteen notes about the app, written between 2026-11-03 22:25 and 2026-11-04 09:09 (one more, `cfb7` on Exodus 3:12, is
the person's own study note). The person asked for them to shape the design round: which areas to redesign, and how
much. Each is listed once.

### Redesign (phase 2b step 4)

| Area | Notes | What they say | How much |
|---|---|---|---|
| **The Notebook and the Journal** | `09ef` | The writing box reads like a chat, which suits short notes only; the Journal is meant for long writing (and still quick capture). "Take the notebook feature back to the drawing board until we get a settled design." | **From the start**, several designs to choose from |
| **Reading plans** | `fbf6`, `6d32`, `c440`, `9ded` | More modular, less typed text, to avoid mistakes. Only a name and the scriptures required; days and dates optional ("like building your own form"); no separate "plan of your own" if the builder is good. Several books are hard to give ("--books" makes no sense in the window). Drag a day ahead in Days; "Spread the rest…" is unclear | **From the start**, several designs (the pane built in step 3 is the first try) |
| **The dock** | `564e`, `8c69` | Dockview-style tabs; a thread opened from the threads list opens on the right even after the list was moved: new tabs should open where their pane sits | As planned (item 18), plus where new panes open |
| **Threads** | `73c4` | Sort the scriptures and notes in a thread; filter and search them | A thread pane design |
| **Help** | `9ded` | Every button and feature with a clear entry in a guide that is easy to find from Help | A Help design: the manual plus a guide to the window |
| **Word definitions** | `0e98` | Click a word (in Strong's and BDB entries, and in your own notes) to get its English definition, since some words in the definitions are unfamiliar | A design, and a decision: which dictionary (it must be a source with a clear license, as the Bible texts are) |

### Fix now (small)

| Note | What it says | What to do |
|---|---|---|
| `c35b` | The color bar should close on a click or tap outside it | Close it, and clear the selection, on a click away |
| `5a5a` | Writing a note resets the reading plans pane | Every write refreshes every pane, which redraws the plans pane and closes what was open. Refresh a pane only when what it shows changed, and keep what was open |
| `8c69` | New thread tabs open on the right | A pane opens in the column where a pane of its kind (or the list it came from) is |
| `c440` | "--books" in the plan form | No terminal flags in the window's words (until the plans redesign replaces the form) |
| `e998` | A key for the Notebook on the desktop | A shortcut that opens and focuses the Notebook's writing, listed in Keys |
| `c8dc` | Remove a verse a note is attached to | "Take off" on each of a note's places; a note's last place taken off sends it to the Inbox |

### For the person to decide

| Note | What it asks | The question |
|---|---|---|
| `e48c` | Notes in the Trash should have a permanent delete | "Erase now" on a note in the Trash (asked to confirm), beside the 7 days? It erases, so it changes the rule in CLAUDE.md |
| `032f` | A chronological reading plan | The app ships no plan whose order is a judgment (reading.rs). Which published chronological plan, from what source, to import? |
| `0e98` | A dictionary | Which English dictionary, with its license (for example a public-domain one) |

## 13. Phase 2b, tier 0: the day-3 fixes (2026-11-04)

Tier 0 of [PLAN-phase2b-build.md](PLAN-phase2b-build.md): the six "fix now" notes of section 12 and the person's decision
on `e48c`. No new kind of file: a note taken off its places is an Inbox note (`notes/_inbox/`) or a note on a thread
(`notes/_threads/`), as before; a note whose first place comes off moves to the next place's book folder in the Python
app's format (the Python `wb note list "Psalms 106"` lists it there, checked on a scratch folder).

| # | Note | Built | Checked |
|---|---|---|---|
| 0.1 | `c35b` | A press anywhere away from the color bar (a pane, the toolbar, the margin) closes it and clears the selection; menus and cards opened from the bar keep it | desk: select, click in a pane, no bar, no selection |
| 0.2 | `5a5a` | `app.changed(what)`: each write says what it changed (notes, threads, highlights, plans, sets) and only the panes that show it are drawn again, keeping their scroll; the panes that show only the Bible database are never drawn again by a write. The plans pane keeps its open Days and what was typed in its forms when it is drawn again | desk: Days open, Mark read, Days still open; a note written, the plans pane not drawn again |
| 0.3 | `8c69` | A new pane opens in the column of a pane of its kind, else in the column it was opened from (the column last pressed in, within a few seconds, forgotten on typing elsewhere), else its usual side. So a verse opened as a tab from a note opens beside the Notebook | desk: Threads moved left, a thread opened from it opens left; `thread …` from the command field opens beside it |
| 0.4 | `c440` | The books kind reads "The books you choose, in the Bible's order"; no `--` in the pane. Several books: names, groups and runs joined by commas or semicolons (`gospels, rom`, `Matt-John, Rom`, `Gen-Deut; Ps`) | CLI `a_plan_of_several_books_reads_them_in_the_bibles_order`; desk: the form's words, `gospels, rom` starts a plan ending at Romans 16 |
| 0.5 | `e998` | Ctrl+J, from anywhere (a field too): the Notebook's Journal with the cursor in its writing box; listed in Keys | desk: from the reader and from the command field; Keys lists it |
| 0.6 | `c8dc` | `wb note unplace <id> <place>` (`Store::unplace`): another place comes off as `note also --remove` does; the first place, and the next becomes its place (its file moves there); the last, and it goes to the Inbox (a question stays a question, answered or not; a note still on a thread goes to `notes/_threads/`). × on each place chip in the Notebook, "Take it off …" for every place in its ⋯ menu, and Take off in Notes & lookup | CLI `a_place_is_taken_off_a_note_its_first_too_and_the_last_sends_it_to_the_inbox`; desk: × on the first place, then on a last place |
| 0.7 | `e48c` | Erase now on each note and question in the Trash, after a confirm ("It cannot be put back"); `wb trash erase <name>` (`Store::erase`), refused for anything in `.trash` that is not a deleted note or question. CLAUDE.md's rule says so | CLI `erase_now_erases_one_deleted_note_and_nothing_else`; desk: Cancel keeps it, OK erases the file |

**A bug found on the way:** in the window, where one store stays open, a note whose file moved to another folder
(Move… to another book, and now Take off its first place) vanished from every list until the app was opened again: the
old file was forgotten by the note's id, which the new file shares. `Store::moved` now reads the new file again after
forgetting the old; `a_note_that_moves_to_another_book_stays_in_memory` checks it in one process (the CLI tests, a process
each, could not see it).

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs --release`: **96 of 96** (15 new) |
| WebKit | `npm run test:webkit`: **12 passed**, 6 skipped (each test runs at the size it belongs to) |
| Rust tests | `cargo test`: **118** (3 new CLI tests, 1 store test) |
| Golden suite | **99 of 99** the same |

The scratch copy still works for trying things out: `powershell -ExecutionPolicy Bypass -File scripts\watch-app.ps1`.
To try a feature: open the Notebook and write a thought (Enter); place it from the Inbox; press backtick and type
`uses zeal gospels`, `def H7065`, `interlinear Num 25:11`, `+Phinehas`, `thread Phinehas`; turn chapters with ← →; Ctrl+F;
Ctrl+= and Ctrl+-; make the window narrower; from a terminal, `wb do "open John 3:16-18"`.

## 14. Phase 2b, tier 1: the dock (2026-11-04)

Tier 1 of [PLAN-phase2b-build.md](PLAN-phase2b-build.md), designs D1, D4 and V2 ([phase2b-design.md](phase2b-design.md)),
for notes `564e` (tabs dragged as in dockview), `2395` and `8c69` (its first step, from tier 0, replaced). UI only:
`ui/src/dock.ts`, `ui/src/desk.css`, two lines of `ui/src/actions.ts`; no file in the study folder changes. Where panes
were put is kept in the window's own storage (`wb.dock.v1`), as the column widths were.

| # | Built | Checked |
|---|---|---|
| 1.1 | **The base: our dock, extended**, not dockview-core. The spike and the reasons: [PLAN-design.md](PLAN-design.md), section 5 ("The dock's base"). The dock is now made of groups: one tab strip and its panes, in a column, a band or a floating window | `spikes/dock/dockview-spike.mjs` in WebKit at both sizes |
| 1.2 | **Drop zones (D1)** while a tab is dragged, each shown as a dashed box with its name: *Left column*, *Right column* (at the window's edges); *Top band*, *Bottom band* (the top or the foot of the reader: a band across the reader, between the columns, its height dragged at its edge); *Split beside …* (over a pane in a column: the column splits, the tab's own group above or below it); *Beside …* (over any strip: the tab joins those tabs, where it is dropped); *Float* (anywhere else over the reader). Shift over the reader: split beside the pane it came from. A hint says so while dragging | desk: each zone's name while dragging, then where the pane is after the drop |
| 1.3 | **Each float on its own (V2)**: every floating pane is its own window with its own tabs, moved by its strip, sized by its corner, minimized on its own to a chip at the reader's foot (a band minimized waits there too), brought forward by a press. Two floats join only when a tab is dropped on the other's strip. Floating several panes at once (`float all`) makes a window each | desk: two floats, one moved, the other still; one minimized to a chip and shown again where it was; joined by strip |
| 1.4 | **Where new tabs open (D4)**: beside the pane they were opened from, in its group (a column, a band or a float), with "Opened beside Threads, where you put it" when that pane was put somewhere by the person; else where the pane was when it was last closed (a float at the same place, joining the window there); else beside a pane of its kind; else its usual side. **Dock it again** goes back to the column it floated from | desk: a thread opened from Threads in a float opens in that float, and says so; a pane closed in the left column, and a float, each reopen where they were |
| 1.5 | **The place kept**: bands change the reader's height; the reader keeps the verse at the top through each move, as it does through the columns' widths | desk: verse 6 at the top through the top band, the bottom band, a column, the floats; the Psalm 119:50 checks through every size, unchanged |

**On the way:** the floats now stack above one another, so the cards, menus and toasts (`#overlay`) and the toolbar
with its suggestions were raised above every float; before, a float could cover a hover card (one desk check failed so
until this was done). The phone is unchanged: at Compact a pane is still the whole screen with "Back to …".

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs --release`: **123 of 123** (27 new) |
| WebKit | `npm run test:webkit`: **14 passed**, 8 skipped (2 new: the dock at desktop size in WebKit; a pane on the phone is the whole screen with the way back) |
| Rust tests | `cargo test`: **118**, unchanged (no Rust changed) |
| Golden suite | not run: no `wb` command changed |

To try it: drag a tab by its name and watch the box name where it would go; hold Shift over the reader to split it
beside its column; float two panes, move one by its strip, minimize the other, then drop one's tab on the other's strip.

## 15. Phase 2b, tier 2: the Notebook, design B (2026-11-06)

Tier 2 of [PLAN-phase2b-build.md](PLAN-phase2b-build.md), designs N1–N4 and B1–B2 ([phase2b-design.md](phase2b-design.md)
section 7), for note `09ef` (the Notebook from the start) and `e998` (the key, now quick capture). Built in one session,
all seven rows.

| # | Built | Checked |
|---|---|---|
| 2.1 | **The list and the editor (B1).** The list: a search, the pen (a new note), ⋯ (questions only, the Inbox only, the Trash, settings) and **Group: Day, Chapter, Thread, None**. Each line: its title (the first line), a line of what follows, its place, threads, ? for a question. The open note is an editor: its title, its places and threads as chips (× takes one off; + Place, + Thread), the format bar (H B I • 1. “ write Markdown as plain text; Place writes the reader's place into the text; [[ ]] a link; ? Question), and the text shown as a page (headings, lists, quotes, references and links working). A click on the page writes in it, as plain Markdown; it is saved as it is typed (Esc or Ctrl+Enter: done). Wide (the column expanded, or a float), the list and the editor sit side by side; narrow, they take turns with ‹ Notes. `wb notebook --group day|chapter|thread|none [--search] [--at] [--questions] [--inbox-apart]`, `wb note show`, `wb note new` | desk: a new note with no place, its file in `notes/_inbox`, the page and its title; + Place, Move, Answered, the tag, Take off, Delete and Erase now from the editor and its ⋯; side by side when wide; `cargo test` (list by every group) |
| 2.2 | **Places on chapters and books (N1).** + Place offers the verse picked, its chapter and its book (and the place the note names, or one typed: "Numbers 25", "Jude"). A chapter is the run of its verses (`NUM.25:1-25:18`), a book the run of all of them (`NUM.1:1-36:13`): the Python app reads both. Such a note keeps no copy of the text in its header (`quote: ""`), is named "Numbers 25" / "Numbers", and is marked in the reader by a dot at the chapter's title, not on every verse. `note place`, `note also`, `note move`, `note unplace` and `note new` take chapters and books; **`wb note add` keeps the Python app's verses-only rule** (its golden case) | CLI test; desk: + Place → the whole chapter, its anchor, the dot at the title and none on verse 5; the Python app's `Study` on a copy reads both notes |
| 2.3 | **Links (N1).** `[[title]]`, `[[title#heading]]` and `[[title\|shown]]` in a note open that note (at the heading); a title no note has is shown dotted, and a click offers to start it. **Linked from** under a note. Typing `[[` offers the titles. A changed title offers to update the links to it (`wb note relink`). A day's page is linked by its day, `[[2026-11-06]]`, or its title. `wb note links`, `wb note backlinks`, `wb note relink` | CLI test (headings, shown text, relink keeps both); desk: a link opens its note, Linked from lists the linking note, a missing one is dotted |
| 2.4 | **Today's page (N2).** One note per day, first in Group: Day, shown blank ("Not written in yet") and made the first time something is written in it: **new files `notes/_days/<YYYY-MM-DD>.md`**, front matter `id`, `day`, `kind: "day"`, times, no anchor, so the Python app passes over them (checked with its `Study` on a copy). Deleted, a page waits in the Trash as notes do and comes back. `wb day [date]`, `wb day add`, `wb day text`, `wb day rm` | CLI test; desk: today's page first and blank, then its file with no anchor, the format bar's list in the file and on the page |
| 2.5 | **Group by chapter, following the reader (N3).** The chapter being read: the book's notes, then the chapter's, then by verse and word; it turns with the reader. With Follow the reader off, every chapter in Bible order, then the notes on original words | desk: "Numbers 25 · following the reader", then Numbers 26 after the reader turns; the chapter's note first |
| 2.6 | **Quick capture (B2)**: Ctrl+J from anywhere opens a small box at the verse last clicked (else the top of the reader). Enter saves a short note there; Ctrl+Enter saves it and opens it in the editor; × on the place sends it to the Inbox; ? asks it. Writing on a verse from its card (Note, Question) and the pen open a new note in the editor with the place chosen | desk: from the reader and the command field, at verse 7, Enter, Ctrl+Enter, the Inbox; Keys |
| 2.7 | **Settings → Notebook (N4)**, in the Notebook's ⋯ until the Settings window (tier 5): today's page, follow the reader, links, chapter and book places, the Inbox as its own group, the group it opens with, the capture key. **New file `settings/notebook.json`**, one value per key (only those changed). `wb settings notebook [key value]`, `--about` | CLI test; desk: the Inbox as its own group, and the file |

**On the way:** `wb note show` gives an Inbox note the place its text names, as the old Inbox list did (the desk check
found it missing). The Journal, Inbox and All notes of phase 2 are now Group: Day, the Inbox filter and Group: Chapter;
`journal`, `inbox` and `notebook` in the command field open them so. The person's notes of 2026-11-03 to 11-05 read
correctly in the new list (a fresh copy of the real folder, read only): titles from first lines, places, a note on a
thread alone as "On salt 11/5/26".

**Before this build reaches the real folder:** it writes two new kinds of file (`notes/_days/`, `settings/notebook.json`),
so `scripts/backup-study.ps1` is run first (PLAN-phase2b-build, "For every item").

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs --release`: **146 of 146** (Notebook checks rewritten for the list and the editor; 23 new) |
| WebKit | `npm run test:webkit`: **14 passed**, 8 skipped (unchanged: the Notebook calls Rust, so it is checked in the app) |
| Rust tests | `cargo test`: **125** (5 new CLI tests, 2 unit tests) |
| Golden suite | `python scripts/golden.py`: **99 of 99** (`wb note add` keeps the Python app’s rule; every new command is Rust only) |

To try it: Ctrl+J at a verse and write a line; open the Notebook, Group: Chapter, turn the chapter; open today's page,
write `[[` and pick a note; expand the column (⤢) to see the list and the editor side by side.

## 16. What the check found: days 3 and 4 (2026-11-04 and 11-05), and what was built

Seventeen notes about the app, written between 2026-11-04 09:11 and 2026-11-05 18:41 (read from a fresh, read-only
copy of the real folder). Five more from those days are the person's own study (`9e50`, `9a53`, `c873`, `645c`,
`568d`) and are left out. Each note is listed once, by the last four characters of its id; `87bc` ("but notes show up")
goes with `c39a`.

| # | Note | What it says | Where it goes |
|---|---|---|---|
| 1 | `1b2d` | Minimizing a tab in one side panel, even a half-size one, minimizes every side panel | **Fixed now** (a bug in tier 1) |
| 2 | `e3fe` | Take the pen off the desktop view, even when the reader is narrow because of other panes | **Fixed now** |
| 3 | `5e36` | In the ⌄ list of all tabs, a trash on each tab, red on hover, to close it | **Fixed now** |
| 4 | `5c4a` | Ctrl+F should find in the pane you are in, not only the reader | **Fixed now** |
| 5 | `0cf1` | Right-click a verse to open it in a new tab, also in passages opened with `open` | **Fixed now**, with 6 and 7 |
| 6 | `9587` | `open` should show the passage as the reader does (highlights, the same menu), but as a second reader: clicks there do not move the reader | **The person's choice (below), built** |
| 7 | `21bd` | Several passages open at once; a verse clicked outside the reader should not always move the reader: "Go to reader" or "Open in tab" | **The person's choice (below), built** |
| 8 | `523e` | The heights and widths of each side panel adjustable | Tier 1 gave the columns' widths (drag, expand, double-click), the bands' heights and the floats' corners. **What was missing, built now:** the heights of a split column's parts |
| 9 | `4b90` | A clicked verse should look selected, with the color bar, and clear on a click away | **The person's choice (below), built** |
| 10 | `c39a`, `87bc` | Questions do not always show in Notes & lookup, especially a question on part of a verse; notes do | **Fixed now** (a bug: the pane listed only questions on the very same place) |
| 11 | `93b2` | Color customization for the whole app, as deep as the other customizing | **Tier 5**, Settings → Theme (added to the build plan) |
| 12 | `1c6d` | More than one floating tab group | **Already done by tier 1** (V2, section 14: each float on its own, as many as wanted; desk checks "two panes floated are two windows" and "a float moves by its strip on its own") |
| 13 | `2885` | A stopped reading plan goes to a "past plans" page, to reuse or delete, not to the trash | **Tier 3** (added as item 5 of the build plan) |
| 14 | `50c1` | A personal debug place while the app is built, so these notes feed the development | **The person's choice (below), built** |
| 15 | `c419` | Marking a chapter read: a count of times read, and Mark unread | **Fixed now** |
| 16 | `28d3` (11-05) | On touch, in large-tablet mode (the laptop flipped), the note button drops the on-screen keyboard at once | **Checked again** on tier 2's editor with touch emulated over the DevTools protocol: no blur (below). The pen it was likely pressed is gone at desktop sizes (note 2) |
| 17 | `797d` (11-05) | A history of commands in the command field, as PowerShell keeps, failed ones too | **Fixed now** |

### Decided by the person (2026-11-06), and built

| Note | The question | The person's answer |
|---|---|---|
| `9587` | What a passage opened with `open` (or Open as a tab) is | **A full second reader**: its chapter drawn as the reader draws it, its own selection, color bar and cards, its own chapter turning; nothing in it moves the reader, and its menu has "Go to in the reader" |
| `21bd` | What a click on a verse reference outside the reader does | **Ask: the reader or a tab**, a small menu; Ctrl+click goes straight to the reader |
| `4b90` | What a click on a verse number does (it opened the verse's card) | **Select the verse and show the color bar** with the card's actions; a click away clears both; a word's click still opens its card |
| `50c1` | The debug place | **Findings in the app**: a key writes a finding with what was on screen, kept apart from the study, with a Findings list and Handled; `wb findings` for a development session |

### Built

| Note | Built | Checked |
|---|---|---|
| `1b2d` | Minimize hides **the group** it is pressed in, not the whole column: the other part of a split column takes the room, and the minimized part waits as a bar at the column's foot ("H7065", a click shows it again). The other column and the bands never change. A column whose every part is minimized collapses to its edge as before. At Expanded and Medium, where the right column is drawn as one strip, it is minimized as one (`ui/src/dock.ts`) | desk: split the left column, minimize its lower part: one part open, its bar at the foot, the right column open; the bar shows it again |
| `523e` | **The line between a split column's parts drags** to give one part more height (each at least 120 px); double-click gives them the same height again. Widths, band heights and float sizes were tier 1's | desk: drag the line 120 px up, the upper part is 120 px shorter; double-click, the same height each |
| `5e36` | In the ⌄ list of a strip's tabs, **a trash on each tab**, red on hover: it closes that tab and the list stays open with the rest | desk: a trash on every row, red under the pointer, a click closes that tab and leaves the list open |
| `e3fe` | **No pen over the reader** at Large, Expanded and Medium, whatever the reader's width; the pen stays on the phone (Compact). On the desktop a note starts from the Notebook's pen, Note on a verse's bar, or Ctrl+J | desk: no pen at Large, laptop and iPad sizes; there on the phone size |
| `5c4a` | **Ctrl+F finds in the pane last clicked or typed in**: a find bar at the pane's top, what is found marked (the CSS Custom Highlight API, so the pane's markup is not changed), Enter / Shift+Enter and ↑ ↓ to step, Esc to close. After a click in the reader (or the toolbar) it finds in the chapter as before. In Keys (`ui/src/panefind.ts`) | desk: in Keys, "chapter" found there and the reader's bar not opened; Esc closes it; after a click in the reader, Ctrl+F is the chapter's |
| `9587` | **A second reader.** `open John 3:16-18`, Open as a tab on a verse, a reference's card and Open in a new tab open a pane that draws the passage's chapter as the reader does (highlights, thread lines, note and question marks), the verses asked for marked and scrolled to. In it: a word's card, a verse picked with its bar, words selected with the color bar, Alt+click for the interlinear, ‹ › to turn its own chapter, and "Go to in the reader" in its head (the verse at its top) and in a verse's right-click menu. Its marks are drawn again after a write, the text and its place kept. Nothing in it moves the reader. Several places at once (`excerpt`) and the KJV with the YLT (`compare`) stay a list, each verse asking as in `21bd`. One color bar at a time: a selection in one reader clears the other's (`ui/src/main.ts`: each reader is a "view" with its own selector) | desk: right-click → a second reader at verse 14, the reader's verse at the top unchanged; it draws the verse 12 highlight; verse 15 picked there, the main reader's selection empty; 1 colors it yellow in the study folder and both readers draw it; a word's card; › to Numbers 26, the reader still at Numbers 25; Go to in the reader → Numbers 26:3; `wb do "open John 3:16-18"` → verses 16–18 marked, verbatim |
| `21bd` | **A verse clicked outside the reader asks**: "Go to in the reader" or "Open in a tab" (a second reader); Ctrl+click goes straight there; on a phone it goes there as before. In search, every use and the other result lists, a thread's places, find, the highlights list, the place chips of notes in the Notebook and on threads, and the verse rows of a several-place passage | desk: a search row asks, the reader stays; Open in a tab opens a second reader; Ctrl+click moves the reader there |
| `0cf1` | **Right-click a verse** (its number or any word) in the reader or a second reader: Open in a new tab, Go to in the reader (in a second reader), Select the verse, Notes & lookup, Copy (with its reference). A long press on touch is still the selection | desk: right-click on verse 14 → Open in a new tab; right-click in the second reader → Go to in the reader |
| `4b90` | **A click on a verse number selects the verse**: its words in the selection color, its number filled, and the color bar with the verse's own color and its actions (Note, Question, Thread, Copy, Notes & lookup, Open as a tab); 1–5 color the whole verse (a verse highlight, as the card did), 0 or × takes it off. A click or tap away, or Esc, clears both. A word's click still opens its card. In the YLT, and on a phone, the verse's card opens as before | desk: verse 12 → every word selected and the number filled, the bar's actions; 3 colors Numbers 25:12 blue; a click in a pane clears it; the checks that used the card now use the bar |
| `c39a` | Notes & lookup lists **the questions on the place and on any part of it or around it** (a question on words of a verse shows at the verse, with its place and words on it), not only those on the very same place. **`wb trail list --at <place>`** (Rust only; `"here": true` when on the place itself) | CLI `a_question_on_words_of_a_verse_is_listed_at_the_verse_and_around_it`; desk: words 3–6 of Numbers 25:13 asked with `?`, listed at the verse |
| `c419` | The chapter's end says **"Numbers 25: read 3 times · last Fri, Nov 6"**, with Read again and **Mark unread**: the latest mark comes off the reading log, and its line is kept in **`.trash/reading-unmarked.jsonl`** (nothing is erased). **`wb read times <place>`**, **`wb read unmark <place>`**. The log is the Rust app's own file (the Python app has no reading log) | CLI `a_chapter_counts_its_readings_and_mark_unread_takes_the_latest_off`; desk: Read again counts one more, Mark unread one less and the line in `.trash` |
| `797d` | **The command field's history**, as PowerShell keeps it: every line run, the ones that did not work too (marked with a wavy line when brought back). ↑ in the empty field brings back the line before, ↓ the next; the empty field lists the last six as "Recent" (a click runs one; Enter in the empty field runs nothing). Kept in the window's storage, 500 lines; the first time, it starts from the study folder's log of the last three days (`wb log`, the lines that worked) | desk: `go Num 25:20`, then `go Nowhere 99` (fails); the empty field shows Recent; ↑ ↑ ↓ ↓ gives them back newest first, then the empty field |
| `50c1` | **Findings.** **Ctrl+Shift+J** from anywhere opens a box for a finding; Enter keeps it with what was on screen: the size class and window size, input and touch, the panes open (and where), the place, the version and the build (the commit and the day the UI was built). `finding <words>` in the command field does the same; **Findings** (More ⋯, or `findings`) lists the open ones newest first with ✓ Handled, Open again and Delete (to `.trash`). **New files `findings/<id>.md`**, a header like a note's (`kind: "finding"`, `status`, `context`) and the text. They sit **beside `notes/`, not in `notes/_findings/`** as the question said: the Notebook reads every folder under `notes/`, so findings there would show among the study notes; beside it, the Notebook never lists them and the Python app passes over the folder (it reads `notes/`, `threads/`, `trails/`, `highlights/` and `sets/` only). **`wb findings [--all]`**, `wb finding add|handled [--open]|edit|rm` (an id or its last four characters) | CLI `findings_are_kept_apart_from_the_study`; desk: Ctrl+Shift+J, the file with its context and not in the Notebook, Findings lists it, ✓ Handled |
| `28d3` | **Checked on touch, emulated.** Touch emulation and taps over the DevTools protocol (the web view's own touch events): the Notebook's pen tapped, and a verse tapped then Note on its bar, each followed by typing and the save after typing (the Notebook drawn again). The cursor stays in the note through both, with no blur, so nothing in the window takes the focus away (the on-screen keyboard closes when the field loses focus). What emulation cannot show is Windows' own keyboard; the pen the note was likely about is gone at desktop sizes. **For the person:** try writing a note in tablet mode again on this build; if the keyboard still drops, write a finding (Ctrl+Shift+J) right then: it records the input and size | desk: both taps, typing, 2.5 s, the cursor still in the note, no blur |

**On the way:** typed fast, Enter in the command field could run a suggestion made for the line's first word (`go`
instead of `go Nowhere 99`): Enter now runs a suggestion only when it was made for the line as it stands, else the
line itself. Desk checks scoped to the reader (`#reader .vn`) now that a second reader draws verse numbers too.

**New files in the study folder:** `findings/<id>.md` and `.trash/reading-unmarked.jsonl`, both passed over by the
Python app. So `scripts/backup-study.ps1` is run before this build reaches the real folder.

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs --release`: **185 of 185** (39 new; the checks that clicked a verse number for its card now use the verse's bar, and the passage checks the second reader) |
| WebKit | `npm run test:webkit`: **18 passed**, 10 skipped (4 new: a verse number selects the verse and a click away clears it; the pen only on the phone, in both projects; one part of a split column minimized alone and the tab list's trash) |
| Rust tests | `cargo test`: **128** (3 new CLI tests; the command language's `finding` and `findings` in its unit test) |
| Golden suite | `python scripts/golden.py`: **99 of 99** (`wb trail list` gained `--at`, which only the Rust `wb` has; every other new command is Rust only) |

To try it: click a verse number and press 1; right-click a verse → Open in a new tab, then turn that pane's chapter
with ›; click a row in a search and choose; Ctrl+F after a click in the Notebook; ↑ in the empty command field;
Ctrl+Shift+J and write what you notice; More ⋯ → Findings.


## 17. Phase 2b, tier 3: reading plans, the form and the plan (2026-11-06)

Items 1, 2 and 5 of tier 3 in [PLAN-phase2b-build.md](PLAN-phase2b-build.md); the builder (3) and the published-plan
importers (4) are in section 18. The plans pane is rewritten in its own file, `ui/src/plans.ts`. Designs R1, A2, P1, P2.

| Item | Built | Checked |
|---|---|---|
| **The form** (R1, A2) | A sheet: **Start from** (Blank, Bible in a year, Old and New together, New Testament in 90 days, Psalms and Proverbs, A published plan…) fills its boxes; **Name** and **What to read** required; books as chips, **+ Books…** opens the grid (groups Law, History, Poetry, Prophets, Gospels, Letters of Paul, Other letters; every book; "5 ticked · 105 chapters"; Clear, Back, Done), **+ A passage…**; **Order** (Bible order, As listed, Old and New side by side); **Pace** (finish in N days, by a day, N chapters a day, my own pace with no dates); **Start** (today or a day); **Days off** (Mon to Sun); a **summary** before starting ("27 books · 260 readings · 90 days", "About 3 a day, Nov 6 to Feb 3"). Core: `wb plan start` gains `--books` (names, groups or codes), `--passages`, `--order`, `--pace own\|days:N\|by:DATE\|chapters:N`, `--days-off sun,sat`; `--dry-run` says what it would make. The kinds are presets now; `--kind` still works | CLI `a_plan_has_an_order_a_pace_and_days_off`; desk: preset fills the boxes, the grid counts, the summary follows the form, my own pace has no dates, Start writes the plan |
| **The plan** (P1, P2) | A progress bar; **Today** (or **Next**, on a day off or with no dates) with Read and Mark read; **Days** with a grip, ✓, "missed", "today", "skipped" or the date, **dragged to move**; when days were not read, **four choices that each say what they do to the dates first**: pick up where I left off (shift), fit them into the days left, leave them for later (to the end), skip them. `wb plan missed <name> [--shift\|--fit\|--later\|--skip]` (with none: says each choice's effect), `wb plan move-day <name> --day N --to M`. Each change keeps the old file in `.trash/`. "Spread the rest…" and "Catch up" are gone (the choices replace them; `plan edit --days` and `--catch-up` stay in the CLI) | CLI `days_missed_have_four_choices_…`, `a_day_is_moved_…`; desk: four choices with their dates, asking changes nothing, Skip marks four days skipped, a day dragged to place 6 takes its readings with it |
| **Past plans** (note `2885`) | **Stop** no longer sends a plan to the trash: its file stays in `reading/plans/` with `stopped: <day>`; it leaves Today and the list and waits in **Past plans** (stopped or finished), each with **Use again…** (a new plan from it, on a day chosen) and **Delete** (to `.trash/`, asked to confirm). `wb plan stop`, `wb plan past`, `wb plan reuse <name> [--start D] [--as NAME]`; `wb plan rm` deletes | CLI `a_stopped_plan_waits_in_past_plans_…`; desk: Stop keeps the file stopped, Past plans lists it, Use again, Delete |

**Days off** (a new plan-file field `days_off`) skip their weekdays in every date; a day off shows "A day off · next …" and
Today still lists the days before it that were not read. **My own pace** (`dated: false`) has no dates: each reading waits as a
day, and the plan shows its next. **Skipped** days (`skipped: [3, 4]`) are neither read nor behind. Plan files keep every
field they had; the new ones are `days_off`, `dated`, `skipped`, `stopped`, `pace`, `order`, `books`, `passages`, `reused_from`,
all optional, so an older plan reads as before. The Python app has no reading plans, so nothing it reads changes.

**Built after, in section 18:** the builder (**Arrange the days myself…**, R2) and the importers for Guthrie's, Blue Letter Bible's
and Horner's forms (item 4).

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs --release`: **201 of 201** (the plans checks rewritten for the new pane) |
| WebKit | `npm run test:webkit`: **18 passed**, 10 skipped (the plans pane is not in the WebKit fixtures) |
| Rust tests | `cargo test`: **134** (4 new CLI tests, 2 unit tests; the `every_action` list gained `plans.rs`) |
| Golden suite | `python scripts/golden.py`: **99 of 99** (`plan start` is Rust only; the Python `wb` has no plans) |

To try it: Reading plans → New plan; pick "New Testament in 90 days" and see the summary; Blank → + Books… → Gospels and
Romans; set Sun as a day off; start it; drag a day; start a plan with a start day a few days ago and press
"What should happen?".

## 18. Phase 2b, tier 3: the builder and published plans (2026-11-07)

Items 3 and 4 of tier 3 in [PLAN-phase2b-build.md](PLAN-phase2b-build.md), which finishes tier 3. Core: `plans.rs` (the builder)
and the new `published.rs` (the importers); the window: `ui/src/plans.ts`. Designs R2 and C1.

| Item | Built | Checked |
|---|---|---|
| **The builder** (R2) | From the form, **Arrange the days myself…** opens the days as rows of chapters (each chapter a chip, a day a row). A chapter is dragged to another day (before a chip, or to the end of a row); a day is dragged up or down by its grip; **+** adds a place typed (Psalm 23) to a day; **×** takes a chapter out; **Add a day**; **Remove** on an empty day. A day touched by hand says **kept as you set it** (click it to let it go). The **pace** at the top (N days, by a day, N chapters a day, my own pace) lays the other days out again and leaves the kept ones where they were. **Find a book or chapter** marks chips; the books in the plan are listed with their chapters. **Back to the form** keeps everything: the form says "The days are arranged by hand · 2 kept", and **Edit the days…** comes back to them. Changing what to read or the order in the form drops the arrangement (the days would no longer match). Core: `lay_out` (the pace, with held days), `exact`, `Arranged`; the plan file gains `kept: [day numbers]`, carried by moving a day, a missed-day choice and Use again. `wb plan layout` (the days with chips, nothing started), `wb plan start --arranged FILE\|-`, `wb plan arrange <name> --arranged FILE\|-` (a plan going: new days, old file to `.trash`; what was read stays in the log), `wb plan entries "Psalm 23; Isa 53:1-12"` | CLI `the_builder_keeps_the_days_set_by_hand_when_the_pace_changes` (each pace with a held day, none lost or twice, empty days dropped, kept numbers move up, move-day carries `kept`, arrange keeps the log, errors). Desk: the builder shows 20 days and 89 chips; the form's name and pace come along; a chapter dragged; a day dragged; a place typed; a day let go; a new pace keeps the kept days and every chapter is in one day; back to the form and in again; Start writes the days exactly, with `kept` |
| **Published plans** (item 4) | **A published plan…** in the form: paste the copy you have, say which it is or let the window find out, see what was found before starting. **Guthrie's** `Week N` / `Day N` (readings may go on in the next line; the seventh day of a week is a day off, Sunday unless changed; a Day 7 that is "Rest" is not an error). **Blue Letter Bible's** list (places joined by `/`, a day label in front or not, its short names Jhn, Phl, 1Co, Jde, Rth, Sol, Eze, Joe). **Horner's lists** (`List 1: Matthew, Mark, Luke, John`, any number from 2 to 12): a new kind, **horner**; one chapter from each list a day, each starting again when done, **no end date** (`cycle: true` and the `lists` in the plan file; the days written are one pass of the longest list, and more are made as the dates need them). **One day to a line** as before, with **Where it came from** (Tyndale's One Year Chronological, say: its list is not on the web page and needs the person's own text). The plan file keeps `source`. A plan with no end shows "no end date", never finishes, and offers only "pick up where I left off" and "skip them" for days missed. None is shipped: each belongs to its publisher. `wb plan import --format auto\|plain\|guthrie\|blue-letter\|horner --source NAME --days-off … --dry-run` | CLI `a_published_plan_is_read_from_the_copy_the_person_has` (small samples written for the test, not the publishers' lists; all 66 short names are checked against the Bible's own order; Horner's wrap, a far day, never finished, missed choices, Use again keeps the lists). Desk: Guthrie found from the text with Sunday off, Blue Letter Bible's short names, Horner's no end date, a line that cannot be read named and nothing started |

**Notes.** Where the person's own copies differ from the layouts above (a publisher's list laid out another way), the importer
says which line it could not read; the forms it knows are the ones in the plan file's note `032f`, so a copy that differs can be
told to us as a sample and the reader widened. The builder works on the form's draft; a plan already going can be given new
days from a terminal (`wb plan arrange`), but the window has no button for that yet. The popups of the form now open over it
(the form sits under them).

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs --release`: **230 of 230** |
| WebKit | `npm run test:webkit`: **18 passed**, 10 skipped |
| Rust tests | `cargo test`: **136** (2 new CLI tests; the `every_action` list gained `published.rs`) |
| Golden suite | `python scripts/golden.py`: **99 of 99** (`plan` is Rust only) |

Screenshots: `docs/phase2/1440-plan-builder.png`, `1440-plan-builder-pace.png`, `1440-plan-form-arranged.png`, `1440-plan-published.png`,
`1440-plan-no-end.png`.

## 19. W0: the bug round from the findings of 2026-11-06 (2026-11-07)

The first step of the plan "The Notebook as a workspace" (2026-11-07, a Claude doc; its order of work: W0 the bug round,
W1 the cleanup, W2 the design round, tier 4, then W3 to W6). The person's findings of 2026-11-06 were read from
`findings/` in the real folder (read only; none was marked handled from here: that is the person's to do in Findings).

| Finding | Built | Checked |
|---|---|---|
| `7bc8` (the person wrote it, then deleted it) | A day's heading read "SATURDAY 7 NOVEMBER … 3": the count at the line's far end looked like the date, the 7 like a stray number. Days are now named **"Saturday, November 7"** (`day_label` in `notebook.rs`), the count is a small badge right beside the name. A day's page has the same new title; **a link written with the old name (`[[Saturday 7 November]]`) still finds its page**, as do the new name and the day (`2026-11-07`) | CLI `today_s_page_is_one_note_a_day_made_when_first_written_in` (the new title; links by all three names); desk: the heading reads "Today · Saturday, November 7", its count 6 px from the name |
| `929e` | **A group's heading folds it**: a click hides its notes (the arrow turns), another shows them. Kept in the window's storage by group and key, so a folded day stays folded when the list is drawn again or the app opens again | desk: 42 notes listed → 32 with today folded, still 32 after switching Group away and back, 42 when opened |
| `ad58` | **The `[[` list, rebuilt**: every note that can be linked to (it stopped at 8), recent first; with nothing typed, grouped as Recent, Days, At places, Not placed yet; typed, the titles that start with it first and a count; a list that scrolls inside a box of at most 340 px; opened **at the cursor**, not under the whole page; ↑ ↓ move, Enter or Tab writes the link, Esc closes the list and keeps on writing; "Link to “…”" at the end when no note has that title yet (the link is shown dotted, as before). The note being written is left out | desk: 41 of 41 notes listed, Recent first, the list scrolls, ↓ moves the pick and leaves the text, Esc keeps the cursor, `[[Numbers 25, read` + Enter writes `[[Numbers 25, read again]]` |
| `707d` | **The findings box moves by its head** (drag the title), stays inside the window, and opens where it was last left (the window's storage). A click elsewhere no longer closes it while something is written in it, so a finding is never lost to a stray click; × closes it | desk: dragged 120, 200 px and it moved exactly so; a click in the reader keeps the box and its text; Enter keeps the finding |
| `2dcf` | **Not built here:** `listen` is read aloud, which is phase 6 in the Rust app (it answers "comes in phase 6"); the person heard the chapter in the Python app. Kept as a requirement for read aloud: at a chapter's end, offer Mark read | — |

Left for W1 and W2 (they need the person's decisions in the plan): `c7ab` (the Inbox's name), `e09e` (the ⋯ menu and
Notebook settings), `94a1` (a verse opened from a note, drawn from a few angles). `28d3` still waits for the person to try
writing in tablet mode on the real keyboard.

No new kind of file in the study folder (the folds and the box's place are the window's own storage).

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs --release`: **239 of 239** (9 new) |
| WebKit | `npm run test:webkit`: **18 passed**, 10 skipped |
| Rust tests | `cargo test`: **136** (the day-page test gained the new name and the links by all three names) |
| Golden suite | `python scripts/golden.py`: **99 of 99** (the day names are Rust only) |

Screenshots: `docs/phase2/1440-notebook-folded.png`, `1440-notebook-link-picker.png`.

## 20. W1: the Notebook's sections, and the Inbox retired (2026-11-07)

Step 2 of "The Notebook as a workspace", with the person's decisions of 2026-11-07: **a note with no place is a page**
(the Inbox is retired, finding `c7ab`); pages are edited **block by block** (W3); the design round's sheets are
**reviewed before W3 to W6** are built; **documents from a thread** (tier 4) come right after the sheets.

| Finding | Built | Checked |
|---|---|---|
| `c7ab`, `e09e` | **The sections** replace the Group control and the ⋯ menu's filters, one click each: **Days**, **Pages** (the notes with no place yet: once the Inbox), **Places** (by chapter, with its own **Follow the reader** switch, which was a setting), **Threads**, **Questions**, **All**; the **Trash** is a bin beside the pen, and its list shows the sections too. **⋯ is the Notebook's settings**, cut to what acts on the whole Notebook: Today's page, Links between notes, **Opens with** (any section), Quick capture. Gone from the window: "Notes on chapters and books" (always offered) and "Show the Inbox as its own group". **No count on the Notebook's button**: nothing waits to be sorted. The window's words: "a page of its own (no place yet)" for what was "in the Inbox". `journal`, `inbox` and `notebook` in the command field still open Days, Pages and the Notebook. Core: `wb notebook --group pages\|questions` (and `--pages`); `wb settings notebook group pages\|questions`; the `inbox` setting is gone (a saved one is passed over). **The files do not change:** a page with no place is still `notes/_inbox/<id>.md`, which the Python app passes over, and `wb inbox` keeps its name | CLI `notes_with_no_place_are_pages_and_questions_a_section` and the settings test; desk: the six sections on one line and the bin, no Group and no "Inbox" in the Notebook, Pages = `wb notebook --group pages`, Questions only questions, Follow off lists every chapter (kept in `settings/notebook.json`), the settings' four rows, Opens with: Pages kept |

The person's own settings (read only): `today` and `links` were off, `group` was `chapter`; each still applies, and a
saved `inbox` is passed over.

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs --release`: **247 of 247** (8 new; the badge waits became waits on the files) |
| WebKit | `npm run test:webkit`: **18 passed**, 10 skipped |
| Rust tests | `cargo test`: **137** (1 new) |
| Golden suite | `python scripts/golden.py`: **99 of 99** |

Screenshots: `docs/phase2/1440-notebook-pages.png`, `1440-notebook-settings.png`.

## 21. Phase 2b, tier 4: documents from a thread (2026-11-07)

Started after the person accepted the second pass of the workspace sheets ("the review is good, begin tier 4";
[workspace-design.md](workspace-design.md)). The two documents the person built from the Phinehas thread with the
Python app on 2026-11-03 are now made here: the **Speaker Script** as Word and **Verse by Verse** as slides. This was
what still sent the person back to the Python app.

| What | Built | Checked |
|---|---|---|
| The plan | `wb-core::docs::plan`: the parts of the Python app's `craft_plan.py` the two need, value for value: the themes, the structures (with their own descriptions), the margin of notes and highlights by verse (highlights as character ranges in KJV words), a thread as places and words (a word or phrase inside a verse already in the thread is picked out there), a thread read as blocks, the Pulpit numbering the script's cues follow, the Speaker Script and Verse by Verse plans. **The fingerprint is the Python app's** (`json.dumps(plan, sort_keys=True)`'s SHA-256), so both apps agree whether a document is up to date | `python scripts/doc-plans.py`: every thread in the scratch copy, both plans, **6 of 6 the same** fingerprint as the Python app's own code |
| The Speaker Script (`.docx`) | `wb-core::docs::docx`: Office Open XML written directly (the `zip` crate), with WordCraft's named styles (Title, Subtitle, Heading 1 and 2, Scripture Reference, Scripture End, Study Note, Slide Cue, Delivery Note …) in the theme's colors and fonts, verse numbers in superscript, "Page x of y" | Converted by WordCraft and looked at: the same layout as the Python app's of 2026-11-03, and its text line for line the same as far as the scratch thread goes (`docs/phase2/tier4-speaker-script-page1.png`). Not yet opened in real Word (the plan asks for that: the person's check) |
| Verse by Verse (PDF pages) | `wb-core::docs::deck`: Typst as a library (phase 0's spike moved in), one 960 × 540 page a slide with DeckCraft's boxes and fit sizes, the theme's colors and shapes, your highlights; the fonts are the window's own (Literata, Inter; `crates/wb-core/fonts`, OFL), since the themes' Word fonts are not on every computer. Speaker notes have no place in a PDF and are left out | Looked at page by page (`docs/phase2/tier4-verse-by-verse-slide4.png`); a highlight first covered the line above, fixed |
| The check | After a file is made, the text of the finished file (the .docx read back from the file; the PDF's laid-out pages) must hold every verse the thread holds, word for word, else the file is not kept | `a_file_missing_a_verse_is_not_kept` (wb-core): Word and PDF both refused, nothing left behind |
| `documents/` | The Python app's records and rules: one file per document, brought up to date in place; behind when its thread, notes or highlights change; a file changed by hand is kept as a copy ("… (your edits …)") before a rebuild; a file open in Word stops it; forget, remember, delete. The Speaker Script shares the Python app's record (`thread-phinehas-script`); **the PDF deck has a record of its own** (`thread-phinehas-verse-pdf`, `to: pdf`), which the Python app passes over, so neither app overwrites the other's file | The Python app reads a record made here as *current*; CLI `a_thread_becomes_a_speaker_script_and_a_verse_deck_each_kept_as_one_file` |
| Where files go | `WB_DOCS_DIR`; with the real study folder, the Python app's folder (Documents\Bible Workbench, or `BIBLE_WORKBENCH_PDF_DIR`), where its documents already are; with any other folder, `<study>-documents` beside it, so no test or scratch run writes the person's documents | Every test and the desk run write beside their scratch copy; the golden suite gives both apps empty scratch documents folders |
| `wb` | `wb craft word|deck --thread …`, `wb docs list|show|update|open|forget|remember|delete`, `wb docs plan` (what a document would hold, and its fingerprint), `wb craft designs|theme` | Golden: `docs list`, `docs show and find`, `craft theme` the same as the Python `wb` |
| The window | **Documents** (⋯ → Documents, or `docs`): Make one from a thread (thread, Speaker Script or Verse by Verse, theme), every document with how it stands (Up to date, Out of date, Changed by hand, File missing …), Update, Open, and ⋯ for Make again, Stop keeping it up to date, Delete. A thread's pane lists its own documents with Make. The command field: `doc thread Phinehas`, `deck thread Phinehas verse`, `docs update`, `theme vigil`. The pane is drawn again when asked for and when the window comes back into focus (from Word), since a document's state changes outside the window | Desk: the pane, Make, the deck from the command field, Out of date after a note written from a terminal, Update, the thread's documents, and a lesson's PowerPoint (the Python app's) offering no Update |

**Deliberate differences** from the Python app: the slides are PDF pages, not PowerPoint (phase 5, if PowerPoint itself
is still needed); the other structures (Reading Sheet, Share Copy, Study Sheet, Thread Dossier; Reader, Pulpit, Study
Table, Thread Map), documents from a passage or a lesson, presets and packets stay with the Python app until phase 5,
and say so (`wb craft word --thread x` without `--structure` names the Dossier and offers `--structure script`; the
window starts on what it makes). A document this app does not plan (a lesson's) is never said to be *behind*, and reads *elsewhere* when its file is there (*missing*
when not, as the Python app says). `docs delete` erases the files as the Python app does, but its record goes to the
study folder's `.trash` (CLAUDE.md's rule). The command language's manual still describes WordCraft (it is generated
from the Python app's `commands.js`).

| | Result |
|---|---|
| Plans against the Python app | `python scripts/doc-plans.py`: **6 of 6** fingerprints the same |
| Desktop in the real app | `node measure/desk.mjs --release`: **255 of 255** (8 new) |
| WebKit | `npm run test:webkit`: **18 passed**, 10 skipped |
| Rust tests | `cargo test`: **140** (3 new; the rule that every core action has a command now covers `docs`) |
| Golden suite | `python scripts/golden.py`: **103 of 103** (3 new; a known difference recorded: a lesson's document is not planned here, so it is not said to be behind) |

Screenshots: `docs/phase2/1440-documents.png`; samples: `tier4-speaker-script-page1.png`,
`tier4-verse-by-verse-slide4.png`.

**For the person:** open a Speaker Script made here in real Word, and a Verse by Verse PDF, before trusting them (the
plan's rule: the Craft previews hid bugs before). The real folder is untouched until the app is installed and used.

## 22. W3: pages and blocks (2026-11-07)

Step 4 of "The Notebook as a workspace", drawn on sheets W1.1 and W2 ([workspace-design.md](workspace-design.md)), with
the person's decisions of 2026-11-07: **`pinned` holds a number** (the page's place in Pinned); **"Page inside this
one" also writes `[[New page]]`** in the page, where the `/` menu was opened; **deleting a page moves the pages inside
it up a level**, into its place; **each list item and each to-do is its own block**; **the sidebar replaces the row of
sections when the Notebook is wide**, and the row stays when it is narrow.

| What | Built | Checked |
|---|---|---|
| Pages inside pages | `wb-core::pages`: the tree (every note with no place, and any note inside a page or holding one); a page inside another names it in its front matter (`parent: "<id>"`) with its place there (`order: 1, 2, 3 …`; pages never moved come first, newest first). A parent that is gone, is a day, or would loop is read as none. Pinned is `pinned: <n>`. Moving or pinning a page writes only those fields, and not its time of change. The fields go with a note when it is placed, moved or taken off a place. Deleting a page (`note rm`, `inbox rm`, `trail rm`) first moves the pages inside it up a level | `cargo test`: the tree, loops, the delete rule; CLI `a_page_inside_a_page_and_a_moved_block_read_correctly_in_the_files` |
| Blocks | A note's text read as blocks, each a run of its own Markdown: paragraph, heading, list item, numbered item, to-do, quote, divider, table, fenced block (with what follows its fence: `scripture`, `view`). The first line is the title, apart (a day's page has none). Changing, adding, removing or moving a block rewrites only the lines around it: list items one after another keep a single line break, anything else is apart by a blank line | `pages.rs` unit tests: a page read as blocks; a block changed, added (a blank line typed makes two), removed; moved; a to-do ticked; a title changed |
| `wb` | `wb page tree\|new\|move\|pin\|unpin\|blocks\|title`, `wb block set\|add\|rm\|move\|check` (blocks counted from 1, as `wb page blocks` lists them), `wb notebook sidebar [--at "Num 25"]` | `every_action.rs` covers `pages.rs` |
| The window: a page block by block (sheet W2) | A note that is written in is drawn block by block; **a click writes in that block alone, as its Markdown**, saved as it is typed. Enter at a block's end starts the next one (a list goes on as a list; Enter in an empty item ends it); Backspace in an empty block removes it; ↑ and ↓ at a block's edge go to the next; Esc ends the writing. **`/`** in an empty block opens the block menu, the sheet's ten: Scripture, Heading, List, To-do, Quote, Divider, Table, Link to a page, Page inside this one, View (the scripture and view blocks are written as their fenced blocks; they are drawn from the Bible and listed in W4 and W5). A to-do's box ticks it. **A grip** at a block's left drags it: dropped on the upper half of another it goes before it, on the lower half after. Before the first save of a block, the block is found again by its text, so a page changed meanwhile (another block's writing ending, a terminal) never has the wrong block written over. Drafts (a new note or question not saved yet) and a blank day's page keep the one box for the whole text | Desk: drawn block by block; a click writes in one block; what is written lands in its place in the file; Enter at a to-do's end; a to-do ticked in the file; the `/` menu's ten; Page inside this one; a block moved by its grip; **the file read back** as written, and `wb page blocks` reading it as the window drew it |
| The title, the path, Pages inside | The title is edited in place (`wb page title`; a `#` it had stays), with the offer to update the links to the old title; its references and links still work. Above it, **the path** of the pages it is inside (Pages / … / the page), each a click away. Under it, **Pages inside · N**. The page's ⋯ has **Pin / Unpin**, **A page inside** and **Move inside…** (the tree, without the page itself and the pages inside it, or the top of Pages) | Desk: Pages inside · 1, the path, Pin from ⋯ writing `pinned: 1` |
| The sidebar (sheet W1.1) | When the Notebook is wide (640 px or more): **Today** (today's page and the last days written in), **Pinned**, **Pages** (the tree; + starts a page; a row's + a page inside it; ▾ folds the pages inside), **At the reader** (the chapter the reader shows, with how many notes; a click lists them in the main column, and it follows the reader), **Threads** (a click lists a thread's notes in the main column, with Open the thread), **Questions**, and the **Trash** at its foot. Each part folds (kept in the window's storage, as before). **A page dragged** onto another row goes before it (the top quarter), after it (the bottom quarter) or inside it (the middle); onto Pinned's or Pages' heading, into Pinned or to the top of Pages; a page with no place still drags onto a verse to place it. A search lists every note with its words instead. The width crossing 640 px draws the list again. A draw asked for during a drag waits for the drop, so the drag is not lost under the mouse | Desk: the sidebar's parts and the Trash at its foot, no row of sections; a page dragged onto the middle of another goes inside it (parent and order in its file, one level in in the tree) |
| Narrow | The row of sections stays (W1); **Pages draws the tree**, with Pinned above it | Desk: the W1 Pages check now compares with `wb page tree` (every note with no place is in it); narrow, the page inside one level in |
| The Python app | `parent`, `order` and `pinned` are fields it passes over and keeps | Desk: a page inside a page, given a place, is read by the Python app's own `Study` as a note on its verse with `parent` and `order`; after the Python app rewrites it, `parent` is still in the file and the tree still has it inside its page |

**Changed in the desk checks:** a note's first line is its title, drawn apart from its blocks, so the reference check
looks for the reference anywhere in the editor (it was in the whole-text page); quick capture's Ctrl+Enter opens the
captured note with a new block under its title (it was the whole-text box).

**Left for later, as planned:** At the reader keeps one row (the reader); W1.2's row per open reader comes with W4's
Open menu. Scripture blocks drawn from the Bible, Paragraph | Lines and the verse card are W4; views and templates W5.

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs --release`: **272 of 272** (17 new; two changed, said above) |
| WebKit | `npm run test:webkit`: **18 passed**, 10 skipped |
| Rust tests | `cargo test`: **144** (4 new) |
| Golden suite | `python scripts/golden.py`: **103 of 103** |
| Plans against the Python app | `python scripts/doc-plans.py`: **6 of 6** the same |

Screenshots: `docs/phase2/1440-notebook-sidebar-pages.png`, `1440-notebook-block-menu.png`,
`1440-notebook-pages.png` (narrow: the tree).

**For the person:** before the installed app writes these new fields in the real folder, `scripts/backup-study.ps1`
ran in the person's terminal: 220 files, each the same as the original
(`%LOCALAPPDATA%\bible-workbench-rs\backups\bible-study-data-20261107-181938`). The install waits for the open window
to be closed (`install-app.ps1` refuses while it is open). Open a page in the Python app afterwards to see it read as before.

## 23. W4: scripture blocks and the verse card (2026-11-07)

Step 5 of "The Notebook as a workspace", drawn on sheets W3, W5.1, W5.2 and W1.2 ([workspace-design.md](workspace-design.md)).
Where a sheet named a choice, the drawn one is built (the person's acceptance, 2026-11-07): **Open's plain click goes to
the reader**; **the words put away are kept per verse**; **a row per open reader**.

| What | Built | Checked |
|---|---|---|
| Scripture blocks (sheet W3) | In the file, only the reference, fenced: ` ```scripture `, `Num 25:10-13`, then `lines` and/or `ylt` on their own lines when chosen. **No scripture text is written into a file.** The window draws the verses from the Bible (`wb page scripture`, one call per page drawn): a head with the reference · version, **Paragraph \| Lines** (Lines: a verse to a line), **YLT**, **Open ▾**; the person's highlights on the words, as in the reader (none while the highlights layer is hidden; in the YLT only whole-verse highlights, as the YLT reader shows). A choice is kept in the block's fence (`wb block scripture ID N --lines --ylt`), the reference as it was. The Python app and Obsidian show the fenced reference as it is | Desk: each block's verses equal `wb text` (KJV as a paragraph, the psalm as lines); the highlights are the runs `wb scripture` gives; Lines and YLT kept in the fence and drawn again (the YLT equal to `wb text --version ylt`); back to Paragraph and KJV the fence is the reference alone; the file holds no verse text. CLI: `a_scripture_block_holds_only_its_reference_and_its_verses_come_from_the_bible`; unit: the fence read and written |
| Verses with highlights | `wb scripture "Num 25:10-13" [--version ylt]`: `wb text`'s verses, each also as runs of its words with the highlight on them (the last made wins, as in the reader). The runs are cut out of the verse's text as the database has it, never rebuilt from the word list: joined, they are the verse exactly; a word that cannot be found leaves its part plain | CLI: the runs joined equal each verse; a highlight on a whole verse is one run |
| One Open menu (sheets W3, W5.1, W1.2) | Everywhere a place opens from the Notebook (a scripture block's Open ▾, the place chips of a note, the card's Open the chapter ▾): **In the reader** (the reader goes there; Back returns it) or **In a new reader** (a second reader in a pane; the reader stays). The ticked one is what a plain click does, Ctrl+click the other; a chip's right-click shows the menu. New Notebook setting **Places open in…** (`places`: `reader`, the default, or `new`; in `settings/notebook.json`; `wb settings notebook places new`). On a phone a place opens in the reader | Desk: the menu's two rows, the reader ticked (Click, Ctrl+click); In the reader moves the reader and Alt+← (Back) returns it; Ctrl+click on Open opens a new reader and the reader stays; the setting chosen in ⋯ is in `settings/notebook.json`, and a plain click then opens a new reader. CLI: the setting kept, refused when it is neither |
| The verse card (sheets W5.1, W5.2; finding 94a1) | A click on a reference in a note opens a card at the link: the verse(s) verbatim with the reference and version, the person's highlights, **Interlinear \| Strong's \| Definitions \| Open the chapter ▾**, a pin and ×. **Interlinear**: the verse word by word; **−** puts a word away; the words put away wait as a row of small names in their order ("Put away · a click brings one back"), "N of M words shown", **Show all**, **Put all away**. Which words are put away is kept per verse on this computer (the window's storage), never in the study folder. **Strong's**: the verse's entries in the order their words come, each opening its entry. **Definitions** says it waits for tier 7's dictionary. **The pin** keeps the card as a pane of its own (drawn again when highlights change). Opening the chapter closes the card. Ctrl+click on a reference opens the place at once, as the menu's Ctrl+click row | Desk: the card's verse equals `wb text`; Interlinear's words are `wb interlinear`'s; − twice, the put-away row in order, a click brings one back; still put away when the card opens again; Show all, Put all away; Strong's in order; Definitions; Open the chapter ▾ the same menu; the pin makes a pane with the verse |
| At the reader, a row per reader (sheet W1.2) | The reader's row first, then a row for each second reader (the section is **At the readers** when more than one), each with how many notes are on its chapter; a row lists that chapter's notes in the main column (the reader's, or "in the new reader"), and follows its reader as it turns. It never opens or moves a reader. `wb notebook sidebar --at "Num 25; Ps 106"` gives a row each (`at_readers`) | Desk: rows for the reader and each second reader; the second reader's row lists its chapter's notes (as many as `wb notebook --group chapter --at`), the reader not moved. CLI: two rows with their counts |

**Changed in the desk checks:** a reference in a note opens the verse card, not the old popover, so "Open as a tab" is now
Ctrl+click on the card's Open the chapter (it still opens the verse in a second reader, marked); the sidebar's section is
"At the readers" while a second reader is open; ⋯'s settings list Places open in…. Two waits that a debug build showed
were too short: + Place on a new note now waits for the note to be saved, and the touch check of Note on a verse
measures the color bar once its thread chips are in (it widens, and Note moves). **A fix found on the way:** the
`[[` list could open after the link was already closed with `]]` (its titles arriving late) and stay open over the
page; it now opens only while the link is still being typed.

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs --release`: **297 of 297** (22 new; five changed, said above) |
| WebKit | `npm run test:webkit`: **18 passed**, 10 skipped |
| Rust tests | `cargo test`: **147** (3 new) |
| Golden suite | `python scripts/golden.py`: **103 of 103** |
| Plans against the Python app | `python scripts/doc-plans.py`: **6 of 6** the same |

Screenshots: `docs/phase2/1440-notebook-scripture-blocks.png`, `1440-notebook-open-menu.png`, `1440-verse-card.png`,
`1440-verse-card-interlinear.png`, `1440-notebook-at-the-readers.png`.

**For the person:** W4 writes new lines in notes (the scripture fences) and a new setting; `scripts/backup-study.ps1`
ran in the person's terminal before the install: 229 files, each the same as the original
(`%LOCALAPPDATA%\bible-workbench-rs\backups\bible-study-data-20261107-193752`). The install waits for the open window
to be closed (`install-app.ps1` refuses while it is open).

## 24. W5: views and templates (2026-11-07)

Step 6 of "The Notebook as a workspace", drawn on sheets W4, W6.1, W6.2 and W6.3 ([workspace-design.md](workspace-design.md)).
The one open choice was asked first: **the Notebook starts with no templates** (the person's choice, 2026-11-07; the
design doc's proposal), so nothing is written in the study folder until the person makes one. Where a sheet named a
choice, the drawn one is built: **the four blanks** `{place}`, `{date}`, `{title}`, `{reader}`.

| What | Built | Checked |
|---|---|---|
| The view language | One parser in wb-core (`commands::view_line`) for a view block, the command field and `wb view run`: `notebook`, then any of **`@place`** (a verse, a run, a chapter, a book, or a Strong's number: the notes on any verse of it, a note on a whole chapter or book counting for each verse in it, in Bible order), **`questions`** (or **`open`**, **`answered`**), **`thread <name>`** (a name of more words in quotes), **`days N`** (written in the last N days, today one of them), **`pages`** (the notes with no place), and any other words (each must be in the note). With no `@place`, the newest first. Templates are never listed. `@Num 99` is Numbers' error, not Numbers and the word 99. The command field's `notebook` keeps its filters (`{"cmd": "notebook", "line": "@Num 25 questions"}`); a bare `notebook` is as before. The line is Rust-only, so `commands-cases.json` (the Python parser's answers) has nothing to compare with: its cases are in `the_notebook_commands` | Unit: the grammar's cases and errors; CLI `a_view_lists_what_its_line_finds_and_writes_nothing`: Bible order, questions, open, words, days, a thread that does not exist, `wb parse` |
| A view (sheet W4) | In the file: ` ```view `, the line, ` ``` ` (the `/` menu's View writes `notebook ` ready to finish). The window lists what the line finds each time the page is drawn (`wb page views`, one call per page): a head with the filter mark, **the line** (a click writes it anew, Enter keeps it: `wb block view ID N "<line>"`; a line that cannot be read is not written), **N found**; rows as the Notebook's entries (a question's ?, the title, its place pill); a click opens the note. A template's view holding `{place}` says it is filled when a page is made. **Views read; they never write** | Desk: the rows equal `wb view run`'s, in order, with the count and the line; ? and place pills as `wb view run` gives them; the study folder the same after drawing; the line edited in place written in the fence, the rows what the new line finds; a line that cannot be read not written |
| The command field | `notebook @Num 25 questions` typed there lists the same rows in the Notebook's main column (a narrow Notebook too), under "A view"; a row opens its note, and Back returns to the view | Desk: the same rows as the view and `wb view run`; a row opens its note, Back returns |
| Templates | A template is an ordinary note with **`template: true`** (a page with no place, in `notes/_inbox/`: the Python app passes over it, Obsidian opens it). Its settings are front-matter fields: **`new_name`** (the name new pages get, blanks allowed; a new template's is "<name>: {date}"), **`asks: place`**, **`goes_in`** (a page id; absent: Pages). A page made from one carries **`from_template`** (the template's id), which is what "used N times" counts. The Notebook leaves templates out of the tree, Pinned, its lists, the journal, questions and search (`wb-core::templates`) | CLI `a_page_made_from_a_template_has_its_blanks_filled`; desk: `template: true` in the file, left out of Pages, `--group pages` and search |
| A new page from a template (sheet W6.1) | The pen and Pages' + (and a page's + in the tree): with templates, **A new page** asks Blank page or one of them; with none, a blank page at once, as before. A template's form: **For** (the place, required when it asks; the reader's chapter to start with; "Fills {place} in the template"), **the new page's name** (from `new_name`, filled; it can be changed), **Goes in** (Pages or a page), and **a preview** of its blocks (a scripture block as "Scripture: Numbers 25, from the Bible", a view as its line). **Make the page**; **Edit your templates** opens Templates. The blanks: `{place}` the place given, `{date}` the day it is made ("Saturday, November 7", as Today's page names a day), `{title}` the new page's name, `{reader}` the reader's chapter (from a terminal, `--reader`, else the place). A scripture block's `{place}` becomes the reference (the file still holds only the reference) | Desk: the pen offers Blank page and the template; For is the reader's chapter, the name and the preview filled; Make the page: the file's text is the template's with each blank filled (computed in the check, not by `wb`), `from_template` in it, in Pages; its scripture block draws Numbers 25 equal to `wb text`, its view lists `wb view run`'s rows |
| Templates in the sidebar, editing one (sheet W6.2) | **Templates** under Questions when there are any, with **+** (an empty template, opened to be written); **Templates** at the sidebar's foot beside the Trash (and in ⋯'s settings, for a narrow Notebook) opens the Templates page. A template opens and is edited block by block like any page; above its blocks, a note on what a template is and **its settings**: Names new pages (a click writes it anew), Asks for (A place / Nothing), Puts them in (Pages or a page); its path reads Templates / its name, its head "a template · used N times". Its scripture block shows `Scripture: {place}, from the Bible`. **`{` typed in a template's block offers the blanks**, each with what fills it (the reader's chapter, today). **Save as a template** in any page's ⋯ copies it as a new template with its places taken out: each scripture block's reference and each view's `@place` become `{place}`, and it asks for a place; the copy has no place, thread or page above it; the page stays as it was | Desk: A new template makes one with `template: true` and opens it with its settings; renamed; its blanks shown as blanks; `{` offers the four and the one picked is written; Asks for and Names new pages kept as `asks` and `new_name`; "used 2 times" in its head; Save as a template on the W4 page: `{place}` in both scripture blocks (one keeping `lines`), `asks: place`, no place, the W4 page unchanged |
| Help (sheet W6.3) | Help is **Guide \| Commands \| Keys**. The Guide's entries (**Templates** and **Views**) live in wb-core (`wb guide templates`, `wb guide views`; `--json`); Commands is the manual as before; Keys the keys. `help templates` and the Templates page's **How templates work** open the Guide at its entry. **The Templates page**: each template with what it holds (its headings, or what its blocks are), whether it asks for a place, how often used, and ⋯ (Open it, Make a page from it, Delete); and the note that templates are notes like any other | Desk: the tabs; the Templates entry word for word as `wb guide templates --json`; the Templates page's names and uses as `wb template list`; How templates work opens the entry |
| `wb` | `wb view run "<line>"`, `wb page views ID`, `wb block view ID N "<line>"`; `wb template list\|show\|new\|set\|save\|rm`; `wb page new --template NAME --place … [--title …] [--reader …] [--parent ID]`; `wb guide [topic]` | `every_action.rs` covers `pageviews.rs`, `templates.rs`, `guide.rs` |
| The Python app | `template`, `new_name`, `asks`, `goes_in` and `from_template` are fields it passes over and keeps | Desk: the Python app's own `Study` reads the study folder with templates in it, passes over a template (no place, as every page), and reads a page made from one, once placed, with `from_template`; after it rewrites that page, `from_template` is still there and the template still counts it |

**A fix found on the way:** `help templates` in the command field was refused (the command language knew only the
manual's topics); it now knows the Guide's entries too (`help templates`, `help views`).

**Changed in the desk checks:** none of the earlier ones. W5's block makes its own pages and templates and, at its end,
deletes the templates with `wb template rm` (checked: to `.trash`, the pages made from them stay), so the checks after
it find the pen as before (a blank page at once, with no templates). One wait added inside the block: a page written
from a terminal is waited for in the tree (the Notebook asked to draw again) before it is clicked.

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs --release`: **323 of 323** (26 new) |
| WebKit | `npm run test:webkit`: **18 passed**, 10 skipped |
| Rust tests | `cargo test`: **151** (4 new) |
| Golden suite | `python scripts/golden.py`: **103 of 103** |
| Plans against the Python app | `python scripts/doc-plans.py`: **6 of 6** the same |

Screenshots: `docs/phase2/1440-notebook-a-view.png`, `1440-notebook-a-view-from-the-command-field.png`,
`1440-notebook-editing-a-template.png`, `1440-notebook-a-template-blanks.png`,
`1440-notebook-a-new-page-from-a-template.png`, `1440-notebook-a-page-made-from-a-template.png`,
`1440-notebook-templates.png`, `1440-help-guide-templates.png`.

**For the person:** W5 writes new fence lines (` ```view `) and, once a template is made, new front-matter fields;
nothing is written until the person makes a view or a template. `scripts/backup-study.ps1` ran in the person's
terminal before the install: 231 files, each the same as the original
(`%LOCALAPPDATA%\bible-workbench-rs\backups\bible-study-data-20261107-210019`). Installed the same evening (the window
was closed), built from the working tree on top of `d344b09`: W5 is not committed yet.

## 25. W6: a document from a page (2026-11-08)

Step 7 of "The Notebook as a workspace", drawn on sheets W7.1 to W7.4 ([workspace-design.md](workspace-design.md)), on
tier 4's renderer (section 21). Where a sheet named a choice, the drawn one is built: to-dos left out unless switched on;
a list is your words; a view is its list as it is when made. Two choices the sheets did not settle were asked first (the
person's answers, 2026-11-08): **the Version picker keeps each scripture block's own version** unless KJV or YLT is
picked, which then applies to every block in the documents only (the page is left as it is); and **the Word file shows
its size** on the Made card (Word counts pages only when it lays the document out, so "9 pages" cannot be known here;
the PDF shows its slides).

| What | Built | Checked |
|---|---|---|
| A page as a source (`docs/page.rs`) | A page is read as the Python app reads a lesson: its title, then its blocks in order, then each page inside it (at any depth, in the Notebook's order), each page's title a section. A heading → a section (a SLIDE cue in the Speaker Script, a section slide in Verse by Verse); a paragraph, a quote, a table (a line to a row), a list (each item with its mark) → your words, Markdown's marks taken off (`[[a link\|shown]]` → shown); a to-do → left out, or switched on "To do: …" / "Done: …"; a scripture block → its verses from the database (`scripture::passage`), in its own version (or the one picked), with your notes on those verses as Study lines and your highlights on the slides, as from a thread; a view → its rows as `wb view run` gives them, a line each; a divider → nothing. A to-do inside a page inside is left out (the page inside is one row). The plan is made by tier 4's own `doc_script` and `deck_verse` (`plan::plan_of_blocks`, now shared with a thread's), so nothing new decides where a verse goes | Unit: Markdown's marks; CLI `a_page_becomes_a_speaker_script_and_a_verse_deck_its_to_dos_left_out`: the rows, both files, every verse word for word in its own version, the page inside as a section, to-dos left out and switched on, the version for every block (the page keeps its own), behind after a change and current after `docs update`, gone after the page is deleted |
| What to make (sheet W7.1) | **Make a document…** in a page's ⋯, and **Make one from a page** in the Documents pane. "From the page *title* and the N pages inside it"; Word: **Speaker Script** (on), Share Copy, Study Sheet, Reading Sheet greyed "· phase 5"; Slides: **Verse by Verse** (on, "As PDF pages."), Reader, Pulpit, Study Table greyed; each with the Python app's own description (`wb craft designs`); **Theme** (with what it is best for) and **Version** (As each block shows, KJV, YLT); **Next: what goes in** | Desk: the subtitle, the two on and the six greyed, the descriptions as `wb craft designs`, the theme's best-for and the version |
| What goes in (sheet W7.2) | Each row with its switch, what it is, its words, and what it becomes: a run of to-dos (or of list items) is one row ("2 to-dos: …"); a page inside says what it holds ("· 1 scripture block", "· a view"); a scripture block that does not read, or a view whose line does not, says "Left out" with why. Moving a switch asks `wb craft parts` again, so what it becomes is the core's word. The switches moved from their defaults are kept in the records (`switched`, keyed by what the block says; a to-do's tick does not count), so Make again makes the same choice; a new record starts from the page's other document's. The note: planned from the page each time it is made; nothing copied into the page; scripture from the database only. **Back**, **Make them** | Desk: the rows equal `wb craft parts`'s in order, with their switches and what each becomes; the to-dos off and "Left out: to-dos are for you"; switched on and off again in the window |
| Made, and every verse checked (sheet W7.3) | Each file with **Open**: "Word · 24 KB", "PDF · 9 slides". The check is tier 4's, made on each finished file (a file missing a verse is not kept); the card lists each verse once with where it is ("Script and slides"), and "N of N verses match the Bible (KJV), in both files". Kept in `documents/` as **`page-<id>-script.json`** and **`page-<id>-verse.json`** (source `{"kind": "page", "id": …}`, the plan's and the file's fingerprints, as a thread's; a PDF's slide count as `pages`). **Show in folder** (`wb docs reveal`), **Done** | Desk: both files beside the scratch folder; the verses listed equal `wb text`'s, each "Script and slides"; the records with their fingerprints; every verse in the Speaker Script (read from the file) and on the slides (the PDF's text read by pypdf) equal to `wb text`; the headings and pages inside as sections with SLIDE cues; to-dos left out; the view's rows as `wb view run` |
| The page keeps its documents (sheet W7.4) | At the page's foot, beside Pages inside: **Documents · N**, each with when it was made ("today 14:20", "Thursday") and **Up to date**, or "· changed since" (or file missing, changed by hand) with **Make again** (`wb docs update`, the same file). A click on a document **previews the file in a pane** (on the left, so the page stays in view): a Word document's paragraphs in their styles, read from the file itself (`wb docs preview`); Verse by Verse as its slides, drawn in SVG by the same Typst layout that made the PDF (`typst-svg`), only while it is up to date, when its plan's fingerprint is the file's; one changed since says so, with Make again. Open and Show in folder in its head. (WebView2 does not draw a PDF from the page's own memory in a frame: tried first, it stayed blank.) The Notebook is drawn again when documents change | Desk: none before; Documents · 2, both made today and Up to date; a scripture block added from a terminal: both changed since, with Make again; Make again: Up to date, the same file, the new verse in it from the Bible; the Speaker Script's preview holds its verses, cues and references; Verse by Verse previews as its slides, as many as the PDF has, each drawn |
| `wb` | `wb craft word\|deck --page ID [--on KEY] [--off KEY] [--version kjv\|ylt\|page] [--theme …]`; `wb craft parts --page ID`; `wb docs list --page ID`; `wb docs plan --page ID --to word\|pdf`; `wb docs preview NAME` (a Word file's paragraphs; a deck's slides in SVG while up to date); `wb docs reveal NAME`. A page document's record also works with every `wb docs` command (show, update, open, forget, remember, delete) | `every_action.rs` covers `docs/page.rs`; desk: `--on` puts the to-dos in and the switch is kept for `docs update --force`, then `--off` |
| The Python app | Its `documents.records` lists only `to` word or deck from a passage, lesson or thread, so it passes over the page records (as it passes over the thread's PDF pages), and its ids never start with "page-" | Desk: the Python app's own `documents.records` reads the study folder with the page records in it, lists none of them, and `documents.find` on one says Missing (no error) |

**Changed in the desk checks:** W6's block makes its own pages, and closes its preview panes and the Documents pane at its
end, the Notebook opened again. Two earlier checks were made independent of the day and of the scratch folder: the reading
plan's day off is Sunday unless today is Sunday (then Saturday), since a plan with today off has no reading for today to
check (it failed on Sunday 2026-11-08); and tier 4's check of a lesson's PowerPoint (the Python app's) now writes that
record, in the Python app's format, into the run's own copy, since the scratch folder on disk does not hold one (it had
passed only on a copy an earlier session had changed). The desk runs on the scratch folder as it is on disk (copied from
it through the person's terminal: a refresh from this session's shell had reached only its sandbox).

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs --release`: **344 of 344** (21 new) |
| WebKit | `npm run test:webkit`: **18 passed**, 10 skipped |
| Rust tests | `cargo test`: **153** (2 new) |
| Golden suite | `python scripts/golden.py`: **103 of 103** |
| Plans against the Python app | `python scripts/doc-plans.py`: **6 of 6** the same (a page's plans have nothing in the Python app to compare with; the thread's, now made through `plan_of_blocks`, are the same as before) |

Screenshots: `docs/phase2/1440-w6-make-a-document.png`, `1440-w6-what-goes-in.png`, `1440-w6-made.png`,
`1440-w6-the-page-keeps-its-documents.png`, `1440-w6-preview-the-speaker-script.png`,
`1440-w6-preview-the-verse-deck.png`.

**For the person:** W6 writes nothing in a page. Making a document writes its record in `documents/` (the study
folder) and its file in the documents folder (with the real study folder, Documents\Bible Workbench, as tier 4's).
`scripts/backup-study.ps1` ran in the person's terminal before the install: 242 files, each the same as the original
(`%LOCALAPPDATA%\bible-workbench-rs\backups\bible-study-data-20261108-211135`). Installed the same evening (the window was
closed), built from the working tree on top of `2e4cfa0`: W6 is not committed yet.

## 26. The debug round's Must items, M1 to M6 (2026-11-08)

From [debug-spec.md](debug-spec.md). Nothing written to the study folder changed: no new fields, no new commands.

| Item | Finding | What was done |
|---|---|---|
| M1 | `64c7` | **Reproduced, then fixed.** `measure/real-drag.mjs` drags with the operating system's own mouse (`measure/real-mouse.ps1`: SetCursorPos and mouse_event), which Playwright's synthetic drags cannot. With Tauri's file-drop handler on (as before), a block's grip and a sidebar page both failed; with `.disable_drag_drop_handler()` on the window (`app/src-tauri/src/main.rs`), both work and the files read the new order and parent. Every HTML5 drag in the app was affected, not only blocks. The touch-only second suspect was not needed. |
| M2 | `cd59` | Scrollbars: the standard `scrollbar-width` / `scrollbar-color` removed (they switched the `::-webkit-scrollbar` rules off in Chromium); 8 px, no arrows, a thumb that is clear until the box is hovered or has been scrolled (a capture-phase scroll listener in `main.ts` sets `.scrolling` for 800 ms). The tab row keeps its hidden bar. |
| M3 | `bd54` | Templates: the card summary wraps (`overflow-wrap`), the list is `minmax(0, 1fr)`, the settings rows wrap. |
| M4 | `6ed1` | A block being written is the block: no border, no fill, no padding, `display: block`, the height the text's own (the old `+ 2` for the border is gone). Checked: no text moves by a pixel when a block opens. The `/` menu's state is a hairline underline. |
| M5 | `b59b` | The second reader's head is the title, ‹ › and an arrow icon "Send to the reader" (a new `sendto` icon); the stale line under it is gone; its text is one step (90%) smaller. **The size is the spec's proposal; the person has not chosen it.** The verse's right-click item keeps "Go to in the reader". |
| M6 | `b59b` | A second reader takes the keyboard focus when pressed in (`tabindex=-1`, no ring), so ↑ ↓ PgUp PgDn scroll it natively; ← → turn its own chapter and no longer the reader's. The dock's redraw on a chapter turn takes the pane out of the page and with it the focus: it is given back. |

**Changed in the desk checks:** 6 new checks in `measure/desk.mjs` (scrollbars, block box and shift, Templates wrap at the pane's width, 320 and 240 px, the second reader's head, its keys ↑ ↓ PgDn, its keys ← →); `measure/real-drag.mjs` is a separate script because it takes over the mouse. Two of the desk's first failures were the checks' own (a width wider than the pane; a 2 px height left from the border) and one was a real bug the check found (the focus lost on a chapter turn). A debug-build desk run stopped twice at the template name's `fill` (not investigated; the release build passes it); the numbers below are the release build's.

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs --release`: **350 of 350** (6 new) |
| Real mouse | `node measure/real-drag.mjs --release`: **2 of 2** (the same script fails 2 of 2 with the handler on) |
| WebKit | `npm run test:webkit`: **18 passed**, 10 skipped |
| Rust tests | not run: no wb-core or wb-cli change (the one Rust change is the window's builder in `app/src-tauri`) |

Screenshots refreshed in `docs/phase2/`; new: `1440-notebook-a-block-being-written.png`. Installed the same evening (`scripts/install-app.ps1`), built from the working tree on top of `2e4cfa0`: W6 and this round are not committed yet. No backup was needed (nothing new is written to the study folder).

**For the person:** C1 (files attached to a finding) needs a decision now that the window's file-drop handler is off: a drop zone would need a Browse button, or the handler stays on for that box. S3, S1 and the others are unchanged and next.

## 27. The debug round's Should items, S1 to S8 (2026-11-08)

From [debug-spec.md](debug-spec.md). Nothing written to the study folder changed: no new fields, no new commands (the
window's own state, the folds, is kept in its storage as the section folds are).

| Item | Finding | What was done |
|---|---|---|
| S1 | `c301` | The wide Notebook's side panel folds to a 44 px rail (the opener and the pen) by the control at the head of its search row, or **Ctrl+\** while the Notebook has the focus; the editor takes the room. Kept in the window's storage; it is the width that picks wide or narrow, so a folded panel stays folded across 640 px and back. The narrow Notebook is unchanged. |
| S2 | `4c02`, `23f1` | **Fold all / Open all** above Days, Places and Threads (one control, which says what a click does); an icon for the pages that hold pages in the Pages heading. **Places** with every chapter listed groups the chapters under their book (Bible order, the book's count of notes, each folds; "The whole book" for a book's own notes). Places following the reader is one chapter and is left as it was. |
| S3 | `b737` | **Right-click** (and a long press on touch) on a page's row in the tree, Pinned, a list, a question, a template or a day opens the page's own menu at the pointer: the same builder as ⋯, not a second list. A deleted note in the Trash offers Put it back / Erase now. Not on a block. Delete there is ⋯'s Delete (D1, which is decided but not built, will change both). |
| S4 | `a148` | A deck's preview shows a slide at a time: ‹ › buttons, ← → Home End while the pane has the focus (they never turn the reader's chapter), "3 of 14", a switch to **Show all** (the column). One at a time is the default for a deck, the column stays for a Word file; the choice is kept in the window's storage. |
| S5 | `d84d` | A thread's page in the Notebook lists its places under its notes: the reference and the verse from the Bible (`wb thread show`, word for word, nothing typed), in the thread's order; a click opens the verse card (an original word opens its entry). Read-only. |
| S6 | `b59b` | A second reader's head: its title is the book and chapter picker (this pane only), and **KJV \| YLT** switches this pane alone (redrawn in place, the verse at the top kept). The main reader and the other readers do not move. A pane keeps the key it was opened with, so opening the same place again in the other version focuses this pane. |
| S7 | seen in `findings/` | A finding's `build` is the commit, **+dirty** with the day and time when the tree has uncommitted changes (`docs/` screenshots and `measure/out` do not count). Findings already written are left alone. |
| S8 | `4463` | **The sheet only**, for the person to accept: `design/filter.py` → `design/exports/filter/` (F1 the row closed, F2 open with a chip's menu, F3 three filters on with the view line it writes, F4 the wide Notebook). Nothing is built from it. Open questions on the sheet's side: the Kind chip waits for R1; in the wide Notebook a set filter takes over the main column like At the reader. |

**Found by the desk checks:** my own first right-click guard (for the long press) swallowed a second right-click made within 700 ms of the first; fixed, and the check that found it stays. The first desk run also stopped at two panes of the same kind; the checks were scoped.

**Changed in the desk checks:** 21 new checks (Places by book and Fold all; Days; Pages fold all; right-click on a tree row, a question and a block; Esc; the folded side panel by control and by key; the deck a slide at a time; a thread's places; the second reader's picker and version; the build stamp). One earlier check changed: the deck preview now counts its slides under **Show all**, and the second reader's head check reads past the KJV | YLT switch.

| | Result |
|---|---|
| Desktop in the real app | `node measure/desk.mjs --release`: **371 of 371** (21 new) |
| WebKit | `npm run test:webkit`: **18 passed**, 10 skipped |
| Rust tests | not run: no wb-core, wb-cli or app change |

Screenshots: new `docs/phase2/1440-notebook-places-by-book.png`, `1440-notebook-side-panel-folded.png`, `1440-notebook-a-threads-places.png`; the sheet's four windows in `design/exports/filter/`. Not committed. Not checked with a real mouse or touch (the right-click and long press were driven by Playwright's events; M1 showed what that can miss for drags, which these are not).
