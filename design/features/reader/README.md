# Reader

> **Read [the principles](../principles/README.md) first** (2026-11-22): it says which of this folder's decisions stand under the new frame (desks, bubbles, the dock) and lists any that conflict, for the person to settle.

**State:** up for redesign (the person, 2026-11-24); was: exploring · **Sheets:** `python design/features/reader/reader.py` writes `reader.figcraft` and
`reader.pdf` (the board, one vector page) · Nothing here is built yet.

The reader is the app's centre: a chapter in Literata, verse numbers, the person's highlights, thread underlines and
page marks on the words, a selection, KJV/YLT, and a second reader in a pane. It was built before `design/features/`
existed; this folder designs it for the first time, inside the evolving app (the left rail and trail from
[minimize](../minimize/README.md), the Library from [library](../library/README.md)).

## Leading design (2026-11-12)

The board and its PDF hold only these windows. Superseded ones are left off the board by the script's `DROP` list (see [lead.py](../lead.py)); their drawings are in git history (commit `0d59600`).

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | R1 |  |
| A click and a right click | R2, R3 (A, chosen) | R4, R5 (B, rejected) |
| The margin and one switch | R6, R7 (C, chosen; extended by [marks](../marks/README.md) M25-M28) |  |
| A second reader; a verse alone | R8 (needs more design) | R9 (by [words](../words/README.md) W4, the person's option B, 2026-11-16) |

## What exists today (in code, 2026-11-11)

- `ui/src/reader.ts` draws a chapter in parts (paragraphs, poetry lines, italics, words of Jesus), each word able to
  carry a highlight fill, stacked thread underlines (4px each) and a page's dotted underline; a `?` on a verse number
  with an open question; a chapter title marked when a page is written on the chapter.
- `ui/src/select.ts`: touch — tap a word for its sheet, tap a verse number for the verse sheet, press and hold to
  select; mouse — click a word or verse number for the sheet (a popover when wide), hover cards when `hover on`, drag
  to select. The browser's context menu is turned off in the reader.
- `ui/src/main.ts` `showBar`: a click on a verse number selects the verse and opens the color bar: five colors, the
  three latest threads as chips, and Note, Question, Thread, Copy, Notes & lookup, Open as a tab. In another version
  (YLT) words cannot be selected; a toast says so.
- Second reader: `openSecondReader` opens a place as a tab in a pane.
- `wb` side: `text`, `scripture`, `copy`, `chapter`, `reader`, `books`, `refs`, `parse`; marks through `hl`, `marks`.

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| dc65 (2026-11-11) | Click vs right click: a click looks ugly and opens everything; maybe the right click does that and a click shows the highlights, sleekly |
| 32be (2026-11-10) | On selecting a verse, the interlinear option on the toolbar; a clean dropdown with the colors beside it; the bar is obtrusive |
| 5a80 (2026-11-11) | Annotating like an analog Bible: marks as a layer on the text, not pop-ups (underline, circle, a reference in the margin) |
| 64f0 (2026-11-10) | Highlights and thread bars can be hidden, page and question marks cannot: design continuity |
| b59b (2026-11-09) | A second reader should have the same arrows, place button and KJV/YLT, smaller type, no explaining text, a "send to reader" arrow |
| 94a1 (2026-11-06) | A verse opened from a page should open that verse only, with interlinear, Strong's, definitions |
| 605c | Phone/tablet: swipe sideways between chapters (deferred with the phone) |
| 2c00 (2026-11-12) | Opening a verse in another tab from right-click should select that verse |

## Directions (round 1)

- **R1** today, as built.
- **A** (R2, R3): a click shows only the colors, small, beside the verse; the right click is one clean menu (colors on
  top; lookups, writing, keeping), each line a key and a `wb` command.
- **B** (R4, R5): nothing floats; a selection's tools take the top bar's place (colors, Interlinear, Strong's,
  Write, Save, More ▾).
- **C** (R6, R7): what the person wrote sits in a margin beside its verse, names only (a page, a question, a
  thread's name), each a link; one Highlights/marks panel with an eye for every kind of mark, the margin included.
- **R8**: the second reader with the same navigation and version switch, smaller type, Send to reader.
- **R9**: a verse opened alone, with Interlinear / Strong's / Definitions tabs and Read the chapter. Superseded 2026-11-16 by [words](../words/README.md) W4 (the person chose B; decided by overseer from existing decisions).

A and B are alternatives for click/selection; C can go with either.

## Decisions (the person, 2026-11-11)

- **A click colors, a right click asks (A, R2-R3).** A click on a verse number (or a drag over words) shows only the
  colors, small, beside the selection; everything else is in one right-click menu. B (the selection's tools in the
  top bar, R4-R5) was rejected.
- **C goes with A (R6-R7).** What the person wrote sits in a margin beside its verse (names only, each a link), and
  one panel shows or hides every kind of mark, beside A's click and right click.
- **R8 and R9 need more design.** The second reader and a verse opened alone are not accepted as drawn; a later
  round designs them out further.

## Open questions

- ~~Should a plain click on a *word* still open its sheet?~~ Yes: the word card, or the Concordance by the Reading setting ([words](../words/README.md) W-2, decided by overseer from existing decisions, 2026-11-16); struck.
- C: is a margin the "layer" 5a80 means, or should marks drawn by hand (circles, free underlines) be a later round?
- Which marks get an eye (R7), and is the margin one of them?
- Save (K) and Thread in the menu follow [library](../library/README.md) and [threads](../threads/README.md);
  does Thread stay in the menu at all?
- ~~R9: is a verse opened alone a tab of its own, or the verse sheet made larger?~~ Words W4 is that design (2026-11-16); struck. R8 stays for round 2.
- Round 2: A in detail (the menu on a selection of words, the colors after a drag) with C's margin; R8 and R9 further.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-11 | R1-R9 | Today; A click/right click; B top bar; C margin and one switch; second reader; a verse alone | A chosen over B, C goes with A; R8, R9 need more design (2026-11-11) |

## Data the sheets show

| File | Made by |
|---|---|
| `design/content.json` (`num25`, `num25_ylt`, `interlinear`) | generated from the database by `design/build.py`'s content step (`wb text`, `wb interlinear`) |

Scripture and lookups are fetched from the database, never typed. The marks drawn are `build.NUM25_MARKS` (the scratch
study's); the margin shows names of kinds of marks only, no note text.

## What the build must satisfy

Written once the person accepts a direction.

## Out of scope / later

- Swiping between chapters on a phone (605c): with the phone.
- Highlights by color as topics (b99f): [threads](../threads/README.md) direction C.
- Listen → mark chapter read (2dcf), reading-plan reader (bad6, 540e): [reading-plans](../reading-plans/README.md).
