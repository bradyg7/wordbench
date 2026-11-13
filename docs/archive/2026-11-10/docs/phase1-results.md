# Phase 1: wb-core at parity — results

Done 2026-11-02, started and finished on the person's go-ahead. Phase 1 of [PLAN.md](PLAN.md), section 8: wb-core and the `wb` CLI give the
same answers as the Python app, checked by golden tests that run both on the same inputs.

## Where it stands

**The check of phase 1 passes for the data commands.** The Phinehas walkthrough (`demo/phinehas-command-log.md` in the
Python repository) runs through both `wb`s and gives the same results. That covers sections 1 to 6 and its clean-up: 52
steps, searches, counts, lexicon entries, threads, notes, trails, highlights, the lesson and the set. Every output is
byte for byte the same, and so is the study folder afterwards, file by file. Left out are the window, document and craft
commands, which belong to phases 2 and 5.

```
python scripts/golden.py            # 99 of 99 cases the same (about 15 minutes: the write cases wait for fresh seconds)
python scripts/golden.py search     # only the cases whose name has "search"
cargo test                          # unit tests, including the Python app's own reference cases
```

| | Commands | Golden cases |
|---|---|---|
| Reading and lookups | books, text, copy, preview, chapter, strong, bdb, define, uses, count, search, forms, lexiconc, near, interlinear | 85 |
| Study work | anchor, note add/list/edit/rm, hl set/clear/undo/list, marks, palette, palette rm, thread list/show/new/add/add-many/from-search/from-uses/move/sort/order/rm/edit/delete, set list/show/new/add/rm/rename/delete, trail add/list/done/reopen/edit/rm, find, log, log add, layout list/show, lesson list/show/save/rm/check | 12 (long sequences, each comparing the folders too) |
| The walkthrough | sections 1 to 6 and the clean-up | 1 (52 steps) |

The app's own views stay as `wb reader`, `wb word`, `wb verse` and `wb fixture`.

**In wb-core:**
- `places`: the reference parser, checked against the Python app's own test cases.
- `lookup`: `api.py`, the lookups.
- `scripture`: passages, copy formats, previews.
- `anchors::resolve`: anchor lookups, in the Python app's dict shapes.
- `store`: the study files, read and written in the Python app's exact formats (front matter, the one-space JSON indent,
  Python's separators), with deletes to `.trash/`.
- `studyapi`: `study_api.py` and the lesson files. This includes the no-overlap highlight split, undo, the thread
  operations and the lesson check.

**The rule in CLAUDE.md is now a test:** `crates/wb-cli/tests/every_action.rs` fails if a public wb-core action has no
`wb` command.

**The Python app's unit tests, carried over** (`cargo test`, 97 tests in all):

| Python test file | Rust | Left out |
|---|---|---|
| `test_study.py` | `crates/wb-core/tests/study.rs`, 59 tests | The HTTP server's write guard: the Rust app has no HTTP server (the window calls wb-core in-process) |
| `test_study_cache.py` | `crates/wb-core/tests/store_cache.rs`, 6 tests | |
| `test_search_index.py` | `crates/wb-core/tests/search_index.rs`, the same 38 queries checked against testing every verse, and the rebuild when the database changes | |
| `test_cli.py` (its data parts) | `crates/wb-cli/tests/cli.rs`, 17 tests running the `wb` binary on scratch folders | The window relay, the raw API, Craft and PDFs (phases 2 and 5) |

Where a Python test quotes scripture, the Rust test compares with what the database gives, so no verse is typed in a test.

**One store, kept in step with its folder.** The store reads each file once and again only when the file's time or
size changes. It takes in what it writes, and notices hand edits, new files and removed files (the Python `Study`'s
`_sync`). The app keeps one store and refreshes it, at most once a second, before each request. Phase 0's read-only
`study` module is gone. The reader's colors now save to the study folder through the no-overlap rule, the same as
`wb hl set`, where the spike kept them for the session only.

**Speed:**
- The Rust `wb` answers in 0.1 to 0.8 s a command. The Python `wb` takes about 4 s when it starts its own server.
- The search index and the word offsets that `near` uses are kept in the user's cache folder (`WB_CACHE_DIR`), named by
  the database file's size and time, so a rebuilt database gets new ones.
  - The first search in a run dropped from 250 ms to 22 ms; the first `near` from 140 ms to 8 ms.
  - Once built, a search takes under 1 ms and a `near` about 2 ms.
  - The app builds both in the background as it starts, so the 50 ms search budget holds from the first search.
  - They are in a cache rather than in the database, because the database is the Python repo's and read-only.
- `wb status` says where the database, the study folder and the cache are.

## Known differences (on purpose)

- **Same-second ties.** Records changed in the same second (two threads, two notes) are ordered by file name. A freshly
  started Python server does the same; a long-running one orders them by when it wrote them. The person's data has five
  such pairs (notes and trails written in the same second during the walkthrough).
- **Error wording for a bad regular expression** (`wb search /(/`): each engine's own message. Both refuse it with exit 1.
- **Long usage lines.** argparse wraps them and lists an option's choices; the Rust `wb` prints one line. Both exit 2.
- **`wb help`** lists the Rust commands in its own layout, not the Python text.

## Found along the way

- `wb lesson check` on the walkthrough's lesson says 97 slides in both `wb`s today, but the walkthrough log says the
  check gave 117. Either the count changed in the Python app since, or the log recorded the built deck. Phase 5 should
  settle it against the real build.
- `wb uses ... --cat orig` (and `eng`) is accepted by the Python CLI but refused by its API ("Unknown category.").
  The Rust `wb` does the same for now, so the answers match; the fix belongs in both.

## Not carried over (later phases)

- `wb api`: it reached the Python server's raw routes. There is no server here; every action has a command instead.
- The window commands (`app`, `do`, `ui state`), documents and Craft (`craft`, `docs`, `preset`, `lesson build`, `pdf`),
  and recordings (`record`): phases 2, 5 and 6.
- `layout save` takes a layout from a file for now (`--file`); the window saves its own in phase 2.

## Also in this phase: reading progress and reading plans

These are new; the Python app has neither.

**The files:** `reading/log.jsonl` and `reading/plans/<name>.json` in the study folder (wb-core's `reading` module).
- The log has one line per chapter read. It is append-only, so two devices merge it by keeping both sides' lines.
- A plan's file holds its whole schedule, written when it starts, so the plan never changes under the person.

**The plans:**
- Built-in plans are only those whose order needs no judgment: the Bible's own order over a number of days, with each
  day whole chapters of about the same number of words.
  - `canonical` reads the whole Bible.
  - `ot-nt` reads some of each Testament every day.
  - `nt` reads the New Testament; `psalms-proverbs` reads those two books.
  - `books` reads the books named, such as the gospels.
- A **chronological** plan (or any other order) is imported from a text file, one day to a line: `wb plan import`.
  Putting the books and chapters in historical order is an editorial judgment, and published plans make it
  differently, so under the no-interpretation rule the app does not ship one of its own. The person brings the plan
  they trust.

**Commands:**
- `wb plan kinds`, `start`, `import`, `list`, `show`, `today`, `done`, `rm`
- `wb read mark`, `progress`, `log`

**How progress counts:** a chapter read with a plan named counts for that plan. A chapter read without one (as from the
reader) counts for every plan started on or before that day.

**In the app:**
- a "Mark … read" button at the end of each chapter
- today's readings in the More sheet, each opening its first chapter

**No reminders, notifications or streaks:** it says where the person is, and how far behind or ahead.

Tests: every chapter once and in order in each built-in plan, today and behind, done and marking, importing and its
errors (`crates/wb-cli/tests/cli.rs`).

## A proposal, not built: studying together

The person asked for an idea of social features, study coordination and a community feed. Three rules in the plan stand
against an ordinary one: no notifications or feeds, no interpretation, and it works without a network.
[PLAN-community.md](PLAN-community.md) proposes a small, invited and quiet form that keeps all three, with a clickable mock
([ui/prototypes/community.html](../../../../ui/prototypes/community.html)). **Decided (2026-11-02): the app stays personal.** None of it
is to be built; the proposal is kept for the record.

## What phase 2 starts from

The desktop layouts (PLAN.md section 8) on top of this wb-core: the reader, the command field, hover cards and the color
bar, the dock, the Notebook, threads and layers, search and word study, `wb do`. Every data action they need is in
wb-core now and checked against the Python app.
