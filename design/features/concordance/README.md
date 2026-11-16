# The Concordance

**State:** exploring · **Sheets:** `python design/features/concordance/concordance.py` writes `concordance.figcraft`
and `concordance.pdf` (the board, one vector page) · Nothing here is built yet.

A book on the rail, like the printed Strong's on a desk: "it would really show the whole concordance how it usually
shows if you opened a Strong's concordance", with an easy navigator to find a word quickly and the interlinear for a
verse, passage or chapter (the person, 2026-11-11). It replaces today's word-study panes (Strong's entry, Every use)
as the place they live; a word study opened from it is minimized back into it (see
[minimize](../minimize/README.md)). BDB and Webster's 1913 are separate books on the rail, not tabs here.

## Leading design (2026-11-12)

Not yet reviewed far enough to supersede anything: every window still leads its part.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| The English page and the box | C1, C2 |  |
| The dictionaries | C3, C4 |  |
| Interlinear; from the reader and back | C11a, C12 (per verse, redrawn), C13 (opens where clicked), C14b; cards: fit | C5, C6 (by round 3) |
| An entry's every place; the word card's door | C7-C10 |  |

## Decisions (the person, 2026-11-11)

- **The Concordance is a book on the rail**, its own button (the minimize rounds, H-L).
- **It reads like the printed Strong's**: English words A to Z, each place with a few words around it and the number of
  the original word.
- **Hebrew and Greek are tabs inside the Concordance**, not books of their own.
- **The interlinear is offered inside it**, for a verse, a passage or a chapter.
- **BDB and Webster's 1913 are books of their own** on the rail.

## Open questions

- Round 1 (C1-C6): is the English page right as drawn (word list in the margin, a number opens its entry in the right
  margin)? (Forms were answered in round 1's review.)
- How far does the word list reach: only words that occur in the KJV (as drawn), or the whole printed list?
- What does "In the Concordance" replace on the word card: today's Strong's and Every use actions, or sit beside them?
- Do the dictionary tabs show the open entry's every use (as the English tab does) or only the entry?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-11 | C1-C6 | English page with word list and entry margin (C1), one search box for words, numbers and sounds (C2), Hebrew and Greek dictionary pages in number order (C3, C4), interlinear for a passage (C5), from the reader's word card into the book with the place marked (C6) | Round 1 review below |
| 2 | 2026-11-11 | C7-C10 | All forms / This word switch (C7); an entry with every place, grouped by English word (C8) or by book (C9), with Whole Bible and Near tools; the word card with one In the Concordance door and a map of where its old actions go (C10) | Round 2 review below |
| 3 | 2026-11-16 | C11-C14 | The interlinear and the way back: one verse with a word opened, its parsing and entry under the verse (C11, Greek); a whole chapter with one verse's words open at a time (C12); the interlinear beside the reader, following its verse (C13); deep in the book, a From Numbers 25:11 line with Back to the verse (C14). Hebrew lines read right to left, first word on the right. Redrawn the same day in the real app, mid-study, each question both ways and long words on the cards both ways (`scenes/round3-*.png`, made by `node design/features/concordance/scene.mjs`) | Round 3 review below |

## Scenes in the real app (from round 3)

At the person's request (2026-11-16), rounds are drawn off the code where they can be: `scene.mjs` runs the release
app on its own copy of the scratch study folder (the person's notes, highlights and trail, never the real folder),
makes a few real lookups, then mounts the Concordance as a prototype pane with the dock's own `open()`, drawn with the
app's CSS classes and tokens. Everything around it is the app as built; every word in the pane is a `wb` answer.
The FigCraft board stays for the earlier rounds.

## Data the sheets show

All fetched on 2026-11-11 with the release `wb`, `WB_BIBLE_DB` set to the Python checkout's `datasets/workbench.db`
and `WB_STUDY_DIR` set to an empty scratch folder (nothing written). Never edit by hand; refetch.

| File | Made by |
|---|---|
| `data/concordance-zeal.json` | `wb uses zeal`, `wb uses zealous`, `wb uses zealously`; for each place, the marked word with four words either side, and its number from `wb word <BOOK> <c> <v> <i>` |
| `data/forms-zea.json` | `wb forms zea` |
| `data/lexiconc-zeal.json` | `wb lexiconc zeal` |
| `data/strong-entries.json` | `wb strong <n>` for H7062-H7070 and G2203-G2208 |
| `data/interlinear-num25-11-12.json` | `wb interlinear "Num 25:11-12"` |
| `data/uses-H7068-G2205.json` | `wb uses H7068`, `wb uses G2205`; for each verse, the first marked word with six words either side |
| `data/books.json` | `wb books` |
| `data/interlinear-num25.json` | `wb interlinear "Num 25"` (2026-11-16) |
| `data/interlinear-john2-17.json` | `wb interlinear "John 2:17"` (2026-11-16) |

## What the build must satisfy

Not written yet: the person has not accepted a direction.

## Out of scope / later

- The Notebook and the Shelf together, and what a bookmark means in the app: its own folder, next.
- The trail ([minimize](../minimize/README.md)): the Concordance's steps join it like any tab.

## Round 1 review (the person, 2026-11-11)

- **Forms: a choice, not a rule.** The English page offers all forms of a word together (zeal, zealous, zealously) and
  the one word alone; the reader picks, and the choice is kept (round 2, C7).
- **The word list.** The person understood Strong's as mapped to the KJV only and asked what "the full printed list"
  means. Answer given: the printed concordance does index the KJV's words, but the commonest small words (and, the,
  of ...) are given with references only, in an appendix, and words the translators supplied (italics) carry no
  number. So the open choice is only whether those small words appear.
- **"In the Concordance" replaces** the word card's Strong's and Every use actions; their capabilities (count by book,
  forms, defined by, near, every use) move inside the Concordance (round 2, C10).
- **A dictionary entry lists its places**, like BibleHub: every place the original word stands, the English it is
  rendered by marked (round 2, C8, C9).

## Round 2 review (the person, 2026-11-11)

- **Places under an entry: 4 lines and "N more"** per group, as drawn (C8).
- **A place line keeps a few words around the word**, as drawn. Its reference opens the verse (a pop-up, or to the
  reader); that pop-up is designed with the rest of the app's verse cards so it fits them, not on its own.
- **Small words are included as the printed book does**: the commonest words with references only.
- C7 (All forms / This word), C9 (by book) and C10 (the word card's one door, the old actions moved inside) are kept
  as drawn.
- Build note: the entry's rendering counts are per occurrence (H7068: jealousy 24), the drawn groups were per verse
  (22); the build lists every occurrence so the two agree.
- Next: the Notebook, the Shelf and what a bookmark means ([library](../library/README.md)).

## Round 3 review (the person, 2026-11-16)

- **Moving inside a tab is a step on the trail**: inside the Concordance, a dictionary, the reader or any other tab,
  each move is its own step.
- **Long original words: A, fit.** The cards stay an even grid; a long word's type shrinks until it fits its card
  (`scenes/round3-cards-a-fit-*.png`; B, grow, was not chosen).
- **C11: a, the word opens under the verse**, keeping the verse, the word, its parsing and its entry together. Every
  place is a separate step the reader takes only if they want it, never forced.
- **C12: the words are a toggle per verse**: each verse can be expanded or collapsed, and all at once with Expand all
  and Collapse all (redrawn as `scenes/round3-c12-toggles.png`).
- **C13: it opens where the reader clicked.** Opened from a word or verse in the reader, the interlinear goes to that
  word or verse; after that it does not follow the reader, and the person may go to any other verse or word in it.
- **C14: b, the book stays open beside the reader.** Back to the verse puts the reader on the verse; the book stays
  on its page.
