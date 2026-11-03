# Phase 1: wb-core at parity — progress

Started 2026-11-02 on the person's go-ahead. Phase 1 of [PLAN.md](PLAN.md), section 8: wb-core and the `wb` CLI give the
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

**Speed:**
- The Rust `wb` answers in 0.1 to 0.8 s a command. The Python `wb` takes about 4 s when it starts its own server.
- `search` (0.67 s) and `near` (0.84 s) spend nearly all of that building their word index in each run. PLAN.md section
  2.1 has the answer: build the index into the database ahead of time. That is also what the 50 ms search budget needs.

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

## Still to do in phase 1

1. **The Python unit tests, carried over as Rust tests.** These are `test_study.py`, `test_study_cache.py`,
   `test_search_index.py`, and the data parts of `test_cli.py`. The golden suite already covers their behavior from
   end to end; the unit tests would make it fast to check and runnable without the Python app.
2. **One long-lived `Study` for the app.** It should cache the files and notice changes made from outside (hand edits,
   git pull), as the Python store's `_sync` does. Today the CLI reads the folder fresh each run, and the reader spike
   still uses the phase 0 read-only `study` module; the two should become one.
3. **Smaller commands:**
   - `wb status` (where the database and study folder are)
   - `wb api` (it reaches the Python server's raw routes; there is no server here, so it may not be needed)
   - `layout save` (it needs the window: phase 2)
4. **Build the search index into the database** (or cache it in the app process), for the 50 ms budget.
