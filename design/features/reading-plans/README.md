# Reading plans

**State:** accepted to build (the person, 2026-11-17: answers taken as the overseer recommended, build started) · **Sheets:** `python design/features/reading-plans/reading-plans.py` writes
`reading-plans.figcraft` and `reading-plans.pdf` (the board, one vector page) · Building on `feature/reading-plans`.

Reading plans and the reading log were built before `design/features/` existed. This folder designs them for the first
time, inside the evolving app: the rail and trail come from [minimize](../minimize/README.md), and the reader and its right click come from
[reader](../reader/README.md).

## Leading design (2026-11-12)

The board and its PDF hold only these windows. Superseded ones are left off the board by the script's `DROP` list (see [lead.py](../lead.py)); their drawings are in git history (commit `0d59600`).

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | R1 |  |
| The plan leading the reader, the day as a checklist | R8 (A and B together, C in them), R3 (the end of a reading), R19 (the end of the day) | R2, R4, R6 (by R8) |
| A part of a chapter | R9 (the log), R18 (marking it and going on) | R7 (by R9), R10 (by R9, the person 2026-11-17) |
| Missed days | R17 (a counter) | R11 (by R17) |
| Starting and building a plan | R12, R14 | R5 (by R14) |
| Reading in the Library | R13, reached from the plan pane by R15 and R16 (a placeholder until the Library is a directory) |  |

## What exists today (in code, 2026-11-11)

- `crates/wb-core/src/reading.rs` keeps two kinds of file:
  - `reading/log.jsonl` is append-only, one line per chapter read (`{"t", "ch", "plan"}`).
  - `reading/plans/<id>.json` holds a plan's every day, written out in full when it starts. Fields can be added
    (`days_off`, `dated`, `pace`, `order`, `books`, `passages`, `source`, `lists`, `cycle`).
- The only built-in plans are the books in their own order, balanced by words. Any other order is imported, and the
  module says why: an order is an editorial choice. The app does not remind, nag or count streaks.
- A plan entry is a chapter (`GEN.1`) or a part of one (`PSA.119:1-119:88`). The log, though, records whole chapters
  only.
- `ui/src/plans.ts` draws:
  - one card per plan: a bar, where you are, **today's reading as one label**, Read and **Mark read for the whole day**;
  - Days (drag to move), Rename, Start day, Edit as text and Stop;
  - the four choices for missed days;
  - the form that makes a plan (what to read, order, pace, days off) and the builder for setting days by hand;
  - pasting in a published plan (Guthrie's, Blue Letter Bible's, Horner's ten lists);
  - Past plans, and What you have read.
- `wb` has `plan kinds|start|layout|arrange|entries|import|list|show|today|done|text|edit|rm|stop|past|reuse|missed|move-day`
  and `read mark|when|times|unmark|progress|log`. (`wb log` is a different thing, the capture box's log.)

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 540e (2026-11-10) | As each reading is read in the reader and marked, the plan updates live (green, a progress bar for the day), not one Mark read for all |
| bad6 (2026-11-10) | A plan reader that takes you to the next reading after each one; marking part of a chapter read; seeing as a whole what you have read, and what you have written about |
| 7cef (2026-11-10) | Typing Horner's long lists gets laggy; perhaps Horner as a preset |
| 2dcf (2026-11-06) | After Listen finishes a chapter, a pop-up asks whether to mark it read |

## Directions (round 1)

- **R1** is today, as built.
- **A** (R2, R3): **the plan leads the reader.**
  - Read opens the day in the reader, with a strip under the bar holding the day's readings.
  - Each reading ticks as it is read. A click goes to any reading.
  - At the end of a chapter, one step does "Mark read · next: Romans 2".
  - When Listen has read a chapter through, the same question comes by itself.
- **B** (R4, R5): **the day as a checklist in the pane.**
  - One row per reading, with a bar in ten parts that fills as each reading is read.
  - A reading read in part says where it stopped.
  - Rename, Edit and the rest go under ⋯.
  - A plan starts from a kind (in order, some books, Horner's ten lists, a published plan) instead of typed lists.
- **C** (R6, R7): **what you have read.**
  - The whole Bible, every chapter a small mark shaded by times read. A switch shows where you have written pages
    instead.
  - "Mark read to here" in the verse's right click marks part of a chapter read, shown by a thin line in the margin.

A and B can go together: the strip while reading, the checklist in the pane. C stands apart from both.

## Decisions (the person, 2026-11-11)

- **A and B together, with C in them.** The strip leads the reader while the pane holds the day as a checklist, and what
  was read (C) is part of the same design rather than apart.
- **Horner's ten lists ship as a kind.** The code changes to allow it (reading.rs's rule that no editorial order ships is
  lifted for it). **A chronological plan ships too;** which one is still to be found.
- **A part of a chapter read: both ways are drawn** in round 2: the verses kept in the reading log, or only in the plan.
- **"Written about" means any reference** to that verse or passage (pages, questions, highlights, threads, a place in a
  page), and the map belongs in the [Library](../library/README.md).
- **Missed days, the builder and Past plans are redesigned** to fit A, B and C (round 2).

## Round 2 (2026-11-11)

- **R8:** A, B and C together. The strip leads the reader, and the pane's checklist ticks with it. Under the checklist,
  the chapter you're in shows how often it was read and what refers to it.
- **R9 and R10:** two ways to keep a part of a chapter read.
  - R9 keeps it in the log (`{"ch": "GEN.2", "v": "1-9"}`, a new field the Python app passes over). The map shows the
    chapter half filled.
  - R10 keeps it only in the plan. The log stays whole chapters, and a part read outside a plan is lost.
- **R11:** missed days become one line at the top of the checklist. Opened, it shows the choices. A plan with no end
  (Horner) can't fit days in or leave them for later, so it gets a new choice instead: read the missed days alongside,
  one extra a day.
- **R12:** the builder opens in the reader's place and works by kind. Horner's ten lists stand side by side as columns;
  a plan in days is a row per day, as now.
- **R13:** the Library gets a Reading place. It holds the plan going now, Past plans with how far each got and Use
  again, and the map. On the map, Written about means every reference to a chapter, and a click lists them.
- **R14:** starting a plan offers what ships: in order, some books, Horner's ten lists, a chronological plan (source
  still to be chosen), and pasting a published plan.

## Review of round 2 (the person, 2026-11-11)

- **Chronological plans: find ones that are not copyrighted** (public domain, or an order that may be shipped) before
  one is chosen.
- **Missed days become a counter**: how many days behind (or missed), not a set of choices. R11's choices are dropped.
- **R13 is not clear**: it reads as a page on its own. Round 3 draws the path to Reading in the Library (from the rail,
  the plan pane, the strip) and how the plan and the Library are one.
- Still open: R9 (log) or R10 (plan only) for a part read.

## Decisions (the person, 2026-11-17)

- **A part of a chapter read goes in the log (R9).** A log line gains `v` (`{"ch": "GEN.2", "v": "1-9"}`); R10 is dropped.
- **The Library should become a directory, and that is not designed yet** (it belongs in the [library](../library/README.md)
  folder). Until then Reading is reached from the plan pane (R15, R16), which is a placeholder.
- **The chronological plan is Blue Letter Bible's.** Not yet checked: whether its order may be shipped (a licence
  question; the person asked on 2026-11-11 for a plan that is not copyrighted). The build waits for that check; until
  then the kind is drawn, not built.
- **"Read them alongside" is not wanted** (not important, the person); it goes with R11.
- **The one step at the end of a reading stands, as the overseer recommended:** Mark read · next is one step (R3), nothing
  is marked without a click (not at the last verse, not when Listen stops), and on the day's last reading the step is
  Mark read (R19). Nothing follows the day: no streak, no cheer.
- **"What the build must satisfy" is written after round 3 is reviewed**, not before.

## Round 3 (2026-11-17)

- **R15:** the plan pane's foot has one row, Reading, that opens the Library's Reading place; the pane no longer holds Past
  plans or What you have read. The strip's label, Horner · Day 2, opens the pane.
- **R16:** Reading opens on the plan going now, with ‹ Plan to go back, then Past plans with Use again, then the map.
  Plan and Reading are one thing seen two ways, the day and everything.
- **R17:** missed days are a count in the line under the title ("2 days behind"), quiet, never red, never a prompt. The plan
  does not move; the count falls as days are read ahead. To move the dates, Start day… under ⋯, as now.
- **R18:** a part read, as R9: Mark read to here in the verse's right click, a margin line to the last verse marked, the
  menu on a later verse moves it, the plan's row says where it stopped, the map shows the chapter part filled.
- **R19:** the end of the day: one step, no follow-up.

## Answers (the person asked for the overseer's recommendations, 2026-11-17)

- **RP-1 What the counter counts.** The plan's own `behind` (`reading::progress`): days whose date has come that are
  neither done nor skipped. Days off are not days of the plan, so they never count; reading a day ahead lowers it
  (`ahead` is the other side); a plan "at my own pace" has no dates and shows no counter.
- **RP-2 Parts out of order.** The log keeps each line as written. What is read of a chapter is the union of its lines'
  verses (a line with no `v` is the whole chapter). The row says `read to v. N` while verses 1 to N are all covered, and
  `read vv. 20-25` (the union, as ranges) when verse 1 is not. A chapter adds a time read only when the union covers it
  all; until then the map fills the chapter in proportion to the verses read. Mark read to here on a verse already
  covered changes nothing.
- **RP-3 The plan pane's Reading row** stays when the Library becomes a directory, as the shortcut.
- **RP-4 Blue Letter Bible's order.** Not shipped until the person has confirmed it may be (a licence question the app
  cannot answer). The build adds no Chronological kind; a published plan is still pasted (`wb plan import`). When
  confirmed, adding the kind is a small change under this folder's "Open after merge".

## What the build must satisfy

Lines marked `(desk)` are ticked by the desk check. Each is built or mapped to what exists, with a test.

### The reading log and the map (wb-core)

- [ ] **RP-5** A log line may carry `v`, a verse range string (`{"t","ch":"GEN.2","plan","v":"1-9"}`). Lines without `v` read
  as before; old lines are never rewritten. `wb read mark "Gen 2:1-9"` writes one line with `v` for the verses of
  a place given with verses; a place given without verses still writes whole chapters.
- [ ] **RP-6** One function returns, per chapter, the verses read (the union, as ranges), `times` (a time is counted only when the
  union covers the chapter) and `last`; `read_times`, `last_read`, `overall` and `progress` use it, so a part read
  never counts a chapter as read twice or as done. Rust tests: parts in order, out of order (1-5, 20-25, 6-19), repeated,
  a whole-chapter line after parts, and a plan day with a chapter read in part is not done.
- [ ] **RP-7** `wb read progress` / `wb plan show` give each plan entry `read_to` (the highest verse of the run from verse 1) and `parts`
  (the union as ranges), and `wb read times` gives `verses`; a command for marking to a verse exists (`wb read mark "Gen 2:1-9"`)
  and `wb read unmark "Gen 2:1-9"` takes that part line off (Trash rule: kept in `.trash/reading-unmarked.jsonl`).
- [ ] **RP-8** Mark read to here is a core action: `read_to_here(place)` is what the verse's right click calls and `wb read mark` shares.

### What ships (wb-core, wb)

- [ ] **RP-9** Horner's ten lists is a kind in `reading::KINDS` and `wb plan kinds`: the ten book ranges in their own order, a chapter of each
  list a day, no end date (cycle), built without typing lists (7cef). The old rule that no editorial order ships is lifted for it,
  and the module's comment says so. `wb plan start "Horner" --kind horner` starts it; a Rust test shows day 2 as the ten lists' chapter 2.
- [ ] **RP-10** No Chronological kind is added (RP-4).
- [ ] **RP-11** The plan JSON's reading `behind` and `ahead` reach `wb plan today` and the UI unchanged; a test pins the counter at 0,
  2 behind, and fewer after a day is read ahead, with a day off between.

### The window (ui)

- [ ] **RP-12** The strip (R2, R3, R8, R19): Read opens the day in the reader with a strip under the bar holding the day's readings, which
  tick as each is marked; the open one is marked; a click goes to any; `+N` for the rest; `n of N`. The pane may stay closed.
  The strip's label opens the plan pane (R15).
- [ ] **RP-13** The end of a reading (R3, R19): a card at the chapter's end, `Mark read · next: <reading>` (one step; the next reading opens),
  `Mark read`, `Not now`. On the day's last reading only `Mark read` and `Not now`. Nothing is marked without a click (the last verse
  and Listen stopping do not mark). Nothing follows the last reading: no streak, no cheer, no prompt for the next day.
- [ ] **RP-14** After Listen reads a chapter through, the question comes as today (2dcf) and shares the same Mark read.
- [ ] **RP-15** The pane's checklist (R8): one row per reading with a box, the ten-part bar, `read to v. N` on a reading read in part; Rename,
  Start day, Edit as text, Days, Stop under ⋯; `Go on: <reading>` and `Mark the day read`. Under it, the chapter you are in: read times,
  last read, what refers to it (pages, questions, highlights) as links.
- [ ] **RP-16** Mark read to here is in a verse number's right click; the verses read have a thin margin line (to the last verse of the run from
  verse 1; further ranges each a line); the pane, the strip and the map update at once (R18). Mark the chapter read is the line under it.
- [ ] **RP-17** The counter (R17): `Day N · k days behind` in the quiet type of its line, shown only when behind > 0; never red, no prompt,
  no choices. The five missed-day choices are no longer in the pane. (`wb plan missed` and the core stay as commands: every core action keeps its `wb` command.)
- [ ] **RP-18** Starting a plan (R14, R12): the kinds as cards (Bible in its order, Some books, Horner's ten lists, a published plan to paste); a chosen
  kind shows its first days before Start; the builder opens in the reader's place, by kind: Horner's lists side by side as columns, a plan in days a row a day;
  the text form stays under ⋯. Existing builder abilities (move days, set start, days off) stay.
- [ ] **RP-19** Reading (R13, R15, R16): the pane's foot has one row, Reading, that opens the Library's Reading place (R13) with `‹ Plan` back to the plan pane.
  Reading holds the plan going now, Past plans (how far each got, Use again), and the map with its two layers (Read, Written about;
  Written about counts every reference to a chapter: pages, places in pages, questions, highlights, folders); a click on a chapter lists them,
  and opens the chapter. A part-read chapter is drawn part filled. The pane no longer has Past plans or What you have read.
- [ ] **RP-20** Rust and WebKit tests for each line above (`cargo test -j 2 --no-fail-fast`; `npm run test:webkit`), and a desk case (`measure/desk.mjs`) that
  marks a part, reads on from the strip, and sees the counter. (desk)
- [ ] **RP-21** The reader's place is kept: Read, the strip, Mark read · next and Reading each return to the verse the reader was on. (desk)

## Open after merge

(empty)

## Earlier questions (round 1, answered above or by the decisions)


- A or B, or both? Should the strip show while no pane is open, and hide when the day is read?
- Should "Mark read · next" be one step, or should reading the last verse count as read without a click? (So far
  nothing is marked without a click.)
- Horner's ten lists as a preset (7cef) goes against `reading.rs`'s rule that the app ships no editorial order. Horner's lists
  are ranges of books in their own order. Is that close enough to the books kind to ship, or should it stay pasted
  (with the lag fixed)?
- A part of a chapter read: the log only records whole chapters. Should a new field (verses) be added to a log line,
  or should the part live only in the plan?
- R6: should "Written about" count pages anchored to a chapter, questions, highlights, or all three? Should the map
  also live outside Reading plans (in the Library, say)?
- Missed days, the builder and Past plans are not redrawn this round. Should they keep their current design?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-11 | R1-R7 | Today; A the plan leads the reader; B the day as a checklist, starting from a kind; C what was read as a whole, part of a chapter | A and B together with C; Horner and a chronological plan ship; part-read both ways; written about = any reference, in the Library; missed days, builder, past plans next (2026-11-11) |
| 2 | 2026-11-11 | R8-R14 | A+B+C together; part read in the log or the plan; missed days; builder by kind; Reading in the Library; starting with what ships | non-copyrighted chronological plans to find; missed days a counter; R13 needs its path and integration (round 3); R9/R10 open (2026-11-11) |
| 3 | 2026-11-17 | R15-R19 | The way to Reading and back; missed days as a counter; a part read in the log, marked and moved; the end of the day | (to be reviewed) |

## Data the sheets show

| What | Made by |
|---|---|
| Genesis 2:1-9 | `wb text "Gen 2:1-9"` from the database, when the script runs |
| Books and their chapters | `wb books` |
| Horner day 2 (Matthew 2 … Acts 2) | references only, the first book of each of the ten lists, chapter 2 |
| Read counts on the map (R6) | a drawn sample in the script, not anyone's log |

Scripture is fetched from the database, never typed. The top bar's place button reads "Numbers 25" because
`minimize.slim_bar` draws it fixed, so the sheets cannot change it.

## Out of scope / later

- Highlights by year of reading (ad4c): [reader](../reader/README.md), with marks.
- Streaks and reminders: never (`reading.rs`).
