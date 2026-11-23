# Play-test of 0.3.0's Notebook (2026-11-23)

Played in the real window (release build of `main` at 4180312, a scratch copy of the study folder, 1440×900), then each
bug traced to its source. Open findings from the study folders were pulled in. No fix is made from this page until the
person has answered the questions at the end.

## The goal

A person, new believer or seasoned student, opens the Notebook and it behaves like Notion: one side list (Recents,
Pinned, folders, pages as a tree), a click opens the page in place, a new page is written at once with Enter making
blocks, **nothing typed is ever lost**, Ctrl+Z / Ctrl+Y work, and nothing of the old model (Days/Places/Questions tabs,
cards, "No place yet", + Place, + Thread) is on screen. Each fix is checked in the real window, not only in tests, and
a review scores it; nothing ships under 90/100.

## Why 0.3.0 felt broken (the short answer)

1. **The new side list never draws in the app.** `notebook sidebar` (and `page recents`) asks for the study folder twice;
   in the window that is refused ("the study folder is busy"), in a terminal it is not. The Notebook draws the side list
   and the page together, so one failure blanks both: a wide Notebook shows the old list and opens nothing. The tests
   run the terminal path, so they passed.
2. **The new shell (this folder, accepted 2026-11-22) is not built.** The page editor is new; everything around it is
   the old pane (`ui/src/notebook.ts`, 2,850 lines).
3. **Typing is dropped in two places** (a new page, and Enter pressed while the last block is still saving).
4. **Tests check code, not use.** Window tests read fixtures; no check drives the real app through writing a page.

## Directions

- **Tier 0 first** (the person, 2026-11-23; B1, B8, B11, B14, B21 done; next the check in the real window): the five Tier 0 bugs are fixed first, as a 0.3.1, each on
  `fix/notebook-tier0` with its own test and a review scored 90 or more; then the shell (Tier 1). Questions 1–5 (bubble
  or panes now, undo scope, places and threads, a separate title, the study folder) stay open for Tier 1.

## Tier 0: the spec and where it stands (kept so work survives a compacted conversation)

**How each fix is done** (the person, 2026-11-23): simplest first; each fix gets its own test, then a review agent
(`reviewer`) scores it 1–100 against the goal, and it is reworked until it scores 90 or more. Nothing ships under 90.
After all five, the fixes are checked together in the real window (release build, scratch study copy), then offered
for merge and a 0.3.1 release with the person's go-ahead. No push without it.

**Branch:** `fix/notebook-tier0` from `main` (4180312).

| Bug | What "done" is | State |
|---|---|---|
| B1 side list in the window | `notebook sidebar` / `page recents` answer in the window; the page draws even if the list fails | **Done, reviewed 92/100.** Commits 03f22d8, 799d4af, 20e3632: `Ctx` keeps `lent_root`; `pub const BUSY`; `ui/src/notebook.ts` draw() catches a list failure; `crates/wb-cli/tests/lent.rs` (contract, content, a sweep of 241/249 command bodies through `Ctx::lent`; all fail without the fix). Reviewer's leftovers (optional): argument sets for the 8 unreached commands (word, verse, thread move, block thread/word/study/set/color); a hard list instead of the 80% threshold |
| B8 new page keeps every word | Title, Enter, lines typed straight on with Enter between: every line saved as its own block; the draft form gives way to the block editor | **Done, reviewed 90/100** (reviews 68 → 86 → 90), with B11. Commits 4d4e733, 13c4c23, df9ad77, 3a3a802 (the review's last edge: a refused making while the form was drawn again puts the words in the new form). `ui/src/blocks.ts`: `holdForNewPage(state)` (`ready(id, after)`, `fail()`); `holdKeys(alive, keep, lapse)`: a soft 4 s (a key in another box ends it) and a 30 s cap, and a hold that runs out clears its pending block or focus and shows the held words (`giveBack`, a 10 s toast; `toast(text, ms)` in `sheets.ts`); `afterDrawn` leaves a new page's hold (empty id) alone. `ui/src/notebook.ts` `newPageForm`: `make(onMade)` gives the id before the redraw; Enter on an empty form does nothing. Tests in `ui/tests/writing.spec.ts`: `newPageRun` (plain, slow, refused, redrawn, redrawn and refused). The full chromium-editor project passes (141) |
| B11 Enter during a save is kept | An Enter (and Shift+Enter) pressed while a block is on its way is done in the block that opens; the words after it go to the next block | **Done with B8, reviewed 90/100.** `holdKeys` keeps Enter as `\n` (Shift+Enter `\r`); `putTypedAhead` types up to the first Enter, presses it, and hands the rest to the new hold. `noJoin` (Backspace with no join) and a toggle's Enter (holds at once, `setPending(…, keep)`; a failure puts the line and keys back) go through it. Tests: `slowPage` helper (saves 400 ms), list exit, Shift+Enter with words checked, no-join, toggle, a hold that runs out |
| B14 no stray "/" | / on an empty list line, pick Callout: no `- /` left in the file | **Done, reviewed 93/100** (2026-11-23). Commit 15708ab and the rework after it. Cause: the box held `- /`, which was read as "slash after words"; autosave stored `- /` while the list was open, and taking the slash out left a marker-only line that is never saved. `ui/src/blocks.ts` `slashMenu`: `emptyItem` (a line with only its mark, then ` /`) is an empty line, so the pick writes its form in the line and a close keeps the mark and its space; the class `slashing` holds the autosave while the list is open, on that line only (review finding 1: a line with words keeps saving). Tests in `ui/tests/slash.spec.ts`: `slash_on_an_empty_list_line_writes_the_pick_in_the_line`, `…_closed_keeps_the_mark`, `slash_on_an_empty_todo_line_…` (the first two fail without the fix). Leftovers, parked: a chooser cancelled from an empty item drops the mark; a line holding only " /" keeps a space |
| B21 bullet drag | Dragging bullets reorders them; never "A column marker is not a block" | Done, reviewed 90/100: a drag begun before the page was drawn again after a drop carried the old block numbers, which named a column marker once columns existed; the drop now reads the page and takes a number only from a drawing of the page as it is, else finds the block by its words (two lines alike: asked to drag again), and drops run one at a time (`ui/src/blocks.ts`; tests `drag_right_after_a_drag_*`, `drag_on_an_old_drawing_of_twin_lines_asks_again` in `ui/tests/notebook-blocks.spec.ts`). Side findings parked: a drop near a bullet's start makes columns; a grip drag does not start while a line is written |

**Gotchas met:**
- WB_BIBLE_DB is `C:\Users\brady\github\bible-workbench\datasets\workbench.db`; `WB_REQUIRE_DB=1` makes a missing database fail.
- Run the writing specs with `npx playwright test ui/tests/writing.spec.ts --project chromium-editor -g <name>`; `npm run fixtures` first in a fresh checkout.
- `ui/src/blocks.ts` is CRLF: do not write `\r` / `\n` escapes through a shell heredoc into it (they become real control characters); use the Edit tool or a Python file with `'\\'`.
- The same goes for a Python script written through a bash heredoc: its `'\\r'` can arrive as a real CR. Write such scripts with the Write tool.
- In full `chromium-editor` runs, 2–3 tests flake under load (writing_at_every_width, mark_from_a_page_is_the_reader_s_mark, own_property_add_and_type, and others); they pass alone, both before and after these fixes.
- Context is kept under 200k tokens (the person, 2026-11-23): near it, this page is brought up to date and committed, then a compact is offered.
- The real window for play-testing: build with `npx tauri build --no-bundle` (about 7 minutes cold, longer if the exe is running: copy the exe out before launching), launch with `WB_BIBLE_DB`, `WB_STUDY_DIR` on a copy of `%TEMP%\bible-workbench-rs\study-scratch`, `WB_CDP_PORT=9333`, and drive it with Playwright `chromium.connectOverCDP`.

## Bugs, by priority

Tier 0: breaks the Notebook; small, separate fixes (a 0.3.1).

| # | Bug | Source | Size |
|---|---|---|---|
| B1 | Wide Notebook dead: side list never draws, a click on a page does nothing; "the study folder is busy" | `Ctx::root()` borrows the lent store again (`crates/wb-cli/src/lib.rs:93`); `notebook sidebar` and `page recents` hold `study()` then call `root()`; `draw()` awaits list and page together (`ui/src/notebook.ts:307`). Fix and a failing-then-passing test are ready (stashed) | S |
| B8 | **New page loses words.** Title + first line save on Enter; after that Enter does nothing, words run together on screen and are never saved | `newPageForm` (`notebook.ts:1241`): after the file is made the redraw is skipped because the caret is still "writing" (`writingIn`), so the draft never becomes the block editor; `made` is true so later Enters do nothing | S |
| B11 | Enter pressed while the previous block saves is lost ("bullet bAfter list." saved) | `holdKeys` (`ui/src/blocks.ts:88`) swallows Enter instead of queueing it | S–M |
| B14 | "/" on an empty list line: the picked block goes below and a stray `- /` is saved | the in-line "/" path does not take the "/" out when the pick inserts below | S |
| B21 | Dragging bullet points says "A column marker is not a block" (finding 2766) | a vertical drag read as "beside" (`wb block move --beside`) or the window's block numbers differ from the file's once columns exist; to reproduce | M |

Tier 1: the accepted shell (tickets SH1–SH6 of this folder); most open Notebook findings close here.

| # | Bug | Source |
|---|---|---|
| B2 | Narrow Notebook shows the old list: Days/Pages/Places/Questions/All, cards, Filters form, "Everything ▾" | old pane's `drawList`, `notebookFilters` (SH1, row 37) |
| B10, B13 | "No place yet", "+ Place", "+ Thread", place chips on every page (finding e7ab) | `chipsRow` (`notebook.ts:1179`) (SH1, rows 37–38) |
| B9 | New page opens a dialog first (Blank / templates / Make the page) | `newPage` picker (SH2, row 17) |
| B16 | Ctrl+Z only undoes a deleted block, never typing, a new block or Turn into; no Ctrl+Y (finding 09b7) | `blocks.ts:1771` (SH6, row 35) |
| B18 | Lock: the mark does not unlock on click; place/thread chips and "Give it its own page" stay live when locked (finding 021e) | `lockMark` has no handler (`pagemenu.ts:70`); `chipsRow` ignores the lock (SH6, row 34) |
| B12 | The title is the whole first line (a sentence becomes a 4-line title) (finding 9b88) | title = first line of the file; a separate title is a format change (needs a design) |
| — | Trash cannot be left; New page opens in a hidden tab; Delete All form | old pane (SH2, SH3) |

Tier 2: polish.

| # | Bug | Source |
|---|---|---|
| B3 | Raw Markdown in list previews ("```scripture Matthew 1 ```") | `preview_of` (`crates/wb-core/src/notebook.rs:97`) strips `#`, `>`, `-`, `**`, `[[ ]]` only, not fences, `[!kind]`, `^id`, `<details>` |
| B4 | "Trail: … · 3 John 1" pages full of step lines (finding bc07) | clicking an old trail keeps it as a page (`history keep`) instead of showing it |
| B6 | Opening a page puts "page n_2026…" in the command bar | the trail step's line (`trail.ts:93`) is shown in the command field |
| B15 | / › Callout makes a **Question**; every question carries "Give it its own page" | the callout pick's default kind; the fold button always shown |
| B17 | Esc after writing leaves the whole block "picked" (a box), reading like an error | picking on Escape |
| B19 | "Page locked" and other toasts appear mid-window over the reader | the one toast spot |
| B20 | Ctrl+K preview shows a list as "- item" text | `ctrlk.ts` preview |
| B22 | A Scripture block opens with three rows of controls (Paragraph/Lines, Just the text/With my marks, YLT, Open ▾) before the text | the block's head |
| B23 | Breadcrumb ends in "/" and the title repeats under it | `pathOf` (`notebook.ts:1378`) |
| B7 | `wb page docs` → "Unknown command “page”. Did you mean page?" | the suggestion repeats the first word |

Outside the Notebook, still significant.

| # | Bug | Source |
|---|---|---|
| X1 | The installed app keeps its study folder at `Documents\wordbench-study-data`; `bible-study-data` holds the older work. The findings since 11-19 are only in the first | the setup screen's choice (notebook-shell, out of scope: "the person points Settings › Study folder back") |
| X2 | An empty 280 px margin column beside the reader when the chapter has no margin notes, with only "›" | `margin-col` stays open when empty |
| X3 | The window's in-process path has no tests of its own; a whole class of "works in `wb`, fails in the window" bugs can hide | add a test that runs every read command through `Ctx::lent` (B1's test is the start) and a real-window smoke check of writing a page |

Open findings that belong here: e7ab, 021e, 09b7, 2766 (11-22/23); c301, 929e, 4c02, 23f1, 4463, b737, 6e30, 2c9c, fc71,
9b88, c7ab, 38c2, 7d00, d84d, e09e, 64c7, bd7b, 65b1, 0960, c940, 2306, f126 (older, many answered by the shell).
