# Handoff: what is left of the redesigns (2026-11-09)

Everything the five redesign sessions (R1–R5) finished and committed is merged into `main`, together with the debug
round's C1 and C2 and the WebKit-port fix (`npm run test:webkit` serves each checkout's own UI). Its release build is
made and the study folder backed up; the install waits for the app's window to be closed (`install-app.ps1` refuses
while it is open). This sheet is what is **not** done, packaged as sessions to start later, each with the model
and effort it needs and its brief. **None is started.** Each brief assumes CLAUDE.md and [debug-spec.md](debug-spec.md)
are read first, and ends as every debug item does (desk check, `cargo test`, WebKit where it is layout, a screenshot, a
line in `phase2-results.md`), committed on its own branch, not installed, not pushed.

## Where each redesign stands

| Item | Built and on `main` | Left |
|---|---|---|
| R1 Everything is a page | A thread is a page; the Threads button, pane and tab gone; `/?` `/~` `/word` blocks; one list of questions; `wb study check`, `scripts/py-opens.py`; the CLAUDE.md rule | Real-mouse and phone checks; `/~` and `/word` never clicked through; search does not find threads; no nesting of thread pages; no button for `wb question fold/unfold` |
| R2 The Shelf as a tree | `a1a1918`: folders, Open all, Close all, + Add, moves | A tab dragged onto the Shelf; phone size; pages as tabs (Open all opens only a folder's first page) |
| R3 Documents | Steps 1–5 and the Adjust panel: the preview's look in Word and slides, Literata and Inter embedded, Looks and dials, page switches, the shipped templates (Share Copy, Study Sheet, Reading Sheet, Reader) | Step 6, the parts builder (D4); step 7, the ink measure (D11); the Word file opened in real Word (W-5, yours) |
| R4 Toolbar, More, Settings, themes | Steps 1–5: the Settings pane, More cut down, your own themes, the toolbar from `settings/toolbar.json` with Customize, My commands, Layouts | A layout keeps which panes are open but not their columns, bands or floats; layouts have no keys; a full `cargo test` and desk run after step 5 |
| R5 A word's English definition | Webster's 1913 (your choice): `scripts/build-dictionary.py`, `wb word-define`, the verse card's Definitions tab | Nothing. `python scripts/build-dictionary.py` must have been run once on this computer for the tab to show entries |

**Made while merging (check in package 1):** R4's toolbar listed **Threads** among its standard buttons; R1 removed the
Threads button. The merged `ui/src/toolbar.ts` leaves Threads out of the standard toolbar, though it is still in the
catalog, where it opens the Notebook's pages. A Threads button kept in an existing `settings/toolbar.json` still shows.
Section numbers in `phase2-results.md` were made unique (§28–§35).

**Not run on the merged `main`:** `node measure/desk.mjs --release` (the whole run), `npm run test:webkit`, `python
scripts/golden.py`, `python scripts/py-opens.py`. Each branch passed its own checks, but never all of them together.
`cargo test` and the type check passed on the merge.

## The sessions to start (none started)

Run **package 1 first, alone**: every other package's checks depend on a desk run that passes on `main`, and all of
them touch `measure/desk.mjs`. Packages 2–5 can then run at the same time, each in its own worktree. Expect
`desk.mjs`, `phase2-results.md` and `every_action.rs` to conflict when they are merged; whoever merges second re-runs
the desk.

### 1. The merged `main` checked whole — Opus 5.5, high

> Run every check on `main` as it is after the redesign merge (R1–R5, C1, C2): `node measure/desk.mjs --release` (the
> whole run, not `--settings`), `node measure/real-drag.mjs --release`, `npm run test:webkit`, `python
> scripts/golden.py`, `python scripts/doc-plans.py` (now with R3's design 2: it should still give 6 of 6, as the plan
> holds no styles), `python scripts/py-opens.py`, `cargo test`. The desk run stopped in the Notebook on every branch,
> because the scratch folder is now a copy of the real one (R1's and R3's fix: the run's own copy drops `notes/_inbox`,
> `_threads`, `_days`, `documents`, `findings`, `.trash` and `settings/notebook.json`; R2 and R4 never had it). The
> scrollbar check failed once in R3's run: find out if it is flaky. Check the merge's one judgment: R4's toolbar
> without Threads (R1). Fix what fails, a check or the code, and say which. Done when every script passes on one build
> of `main`, the counts are in a new `phase2-results.md` section, and the screenshots are refreshed. Install only after
> `backup-study.ps1`, in the person's terminal.

### 2. R1 finished — Opus 5.5, high

> The open ends of R1 (`docs/redesign-R1.md`, `phase2-results.md` §30): (a) drag a thread's places by the grip with
> the real mouse (`measure/real-mouse.ps1`, as M1 did) and add it to `real-drag.mjs`; (b) a thread page at phone size
> in WebKit; (c) click through the `/~` thread picker and the `/word` entry in the window, with desk checks; (d) "Search
> every page" finds threads (their names and their notes); (e) a button in the window for `wb question fold` and
> `unfold`; (f) whether a thread page can sit inside another page: the files cannot move, so propose it in
> `settings/pages.json` as Pinned is, and ask the person before building it. Never add a field to a thread's file.
> `scripts/py-opens.py --compare` before and after.

### 3. R2 finished — Sonnet 5.5, high

> The open ends of the Shelf (`docs/redesign-R2.md`, `phase2-results.md` §31): (a) drag a tab from a tab strip onto a
> Shelf folder (the dock's tabs use their own pointer code, not HTML5 drag, so do the same), checked with the real
> mouse; (b) the Shelf at phone size in WebKit; (c) pages as tabs: R1 settled that everything is a page, so Open all
> opens every page of a folder as tabs, not only the first. If a page in a dock tab is not already a pane kind, ask the
> person before adding one.

### 4. R3 finished — Opus 5.5, high

> Steps 6 and 7 of `docs/redesign-R3.md`: the parts builder (sheet D4) as a pane, where today the parts are only
> switched by `--on/--off`; and the ink measure (D11): pages are known for PDFs, but for Word the count needs Word's
> layout, so propose how before building (an estimate labelled as one, or none). Keep `doc-plans.py` at 6 of 6, and
> check every verse in every finished file, as the docs rule says. W-5 is the person's: name it in the report, don't
> do it.

### 5. R4 finished — Sonnet 5.5, medium

> The parts of R4 left "not as drawn" (`docs/redesign-R4.md`): (a) a layout keeps where each pane is (column, band,
> float and size), not only which are open, and opening it puts them back; layouts the Python app saved still load;
> (b) a key per layout, set in Settings ▸ Layouts, refusing a key already taken (the toolbar's, My commands', the
> reader's); (c) run the full `cargo test` after step 5, which was not done. Don't change the standard toolbar's
> buttons.

## Not code, yours

- **W-5:** open a Speaker Script in real Word and a Verse by Verse PDF, made by this app with R3's new look and the
  fonts embedded. Do this before trusting them.
- **M5:** the second reader's text size (90%) is a proposal, not your choice yet.
- **S8:** the Notebook's filter sheet (`design/exports/filter/`) waits for you to accept it.
- **D1** (destroy on delete, with Undo): decided, not built. Not part of the redesigns; it can be its own session
  (Opus 5.5, high: it changes a rule in CLAUDE.md, and its Undo for a page tree is the part to get right).
- **R6** stays parked until read-aloud (phase 6).
