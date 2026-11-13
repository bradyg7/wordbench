# Reading plans

**State:** exploring · **Sheets:** `python design/features/reading-plans/reading-plans.py` writes
`reading-plans.figcraft` and `reading-plans.pdf` (the board, one vector page) · Nothing here is built yet.

Reading plans and the reading log were built before `design/features/` existed. This folder designs them for the first
time, inside the evolving app: the rail and trail come from [minimize](../minimize/README.md), and the reader and its right click come from
[reader](../reader/README.md).

## Leading design (2026-11-12)

The board and its PDF hold only these windows. Superseded ones are left off the board by the script's `DROP` list (see [lead.py](../lead.py)); their drawings are in git history (commit `0d59600`).

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | R1 |  |
| The plan leading the reader, the day as a checklist | R8 (A and B together, C in them), R3 (the end of a reading) | R2, R4, R6 (by R8) |
| A part of a chapter | R9, R10 (still to choose) | R7 (by R9, R10) |
| Missed days | to be redrawn as a counter | R11 (its choices dropped in review) |
| Starting and building a plan | R12, R14 | R5 (by R14) |
| Reading in the Library | R13 (not clear yet; round 3 redraws the path) |  |

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

## Open questions

- Round 2: should a part read be kept in the log (R9) or only in the plan (R10)?
- Which chronological plan should ship? Many published ones are copyrighted. The choice needs a source whose order may
  be shipped, or an order drawn from public-domain references, and the person decides it either way.
- "Read them alongside" (R11) is a new choice. Is it wanted?
- Should the Reading place in the Library replace the plan pane's Past plans entirely?

Round 1's questions:

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

## Data the sheets show

| What | Made by |
|---|---|
| Genesis 2:1-9 | `wb text "Gen 2:1-9"` from the database, when the script runs |
| Books and their chapters | `wb books` |
| Horner day 2 (Matthew 2 … Acts 2) | references only, the first book of each of the ten lists, chapter 2 |
| Read counts on the map (R6) | a drawn sample in the script, not anyone's log |

Scripture is fetched from the database, never typed. The top bar's place button reads "Numbers 25" because
`minimize.slim_bar` draws it fixed, so the sheets cannot change it.

## What the build must satisfy

Written once the person accepts a direction.

## Out of scope / later

- Highlights by year of reading (ad4c): [reader](../reader/README.md), with marks.
- Streaks and reminders: never (`reading.rs`).
