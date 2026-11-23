# Search

> **Read [the principles](../principles/README.md) first** (2026-11-22): it says which of this folder's decisions stand under the new frame (desks, bubbles, the dock) and lists any that conflict, for the person to settle.

**State:** exploring · **Sheets:** `python design/features/search/search.py` writes `search.figcraft` and
`search.pdf` (the board, one vector page) · Nothing here is built yet.

Search covers the KJV search, Every use, count, forms and near. All of them were built before `design/features/`
existed, and this folder designs them for the first time. Every use of a Strong's number will also live in the
[Concordance](../concordance/README.md). This folder covers how any search is asked and narrowed.

## Leading design (2026-11-12)

The board and its PDF hold only these windows. Superseded ones are left off the board by the script's `DROP` list (see [lead.py](../lead.py)); their drawings are in git history (commit `0d59600`).

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | R1 |  |
| One box | R7 (the command first, then suggestions) | R4 (by R7) |
| Results: filters, counts, whole verses | R8, R9, R10 | R2, R3 (A) and R5 (C) (by R8) |
| Near | R6 |  |

## What exists today (in code, 2026-11-11)

- `ui/src/panes.ts`:
  - `openSearch` finds every verse that has all the words. A pane shows the count, a results bar (tick, copy), 50 rows
    at a time with More, and the found words marked.
  - `openUses` shows Every use of a word or number, with chips for each kind of mark (both, only the original, only
    the English) that work as filters.
- Narrowing is typed: `"quotes"` for a phrase, `zeal*` for endings, `--scope gospels`, `--case`, `--regex`.
- `wb search`, `uses`, `count`, `forms`, `near` and `find` (your pages) exist. Count, forms and near have no window of
  their own.

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| a9d5 (2026-11-11) | Every use should have filters: books, chapters, etc. |
| 8353 (2026-11-09) | A user would rather click through a filter dropdown than type a regex to search the scriptures |
| 149b (2026-11-09) | The Every use pane's design, ticks and marked highlights need looking at again (with the Python app's designs) |

## Directions (round 1)

- **R1** is today, as built.
- **A** (R2, R3): **filters you click.** Three dropdowns under the title replace the syntax:
  - where to look: the whole Bible, a testament, a group, books, chapters, with several ticked at once;
  - how the words match: all the words, the phrase, or starts with;
  - which forms.

  Each is also a `wb` option, and the same dropdowns serve Every use.
- **B** (R4): **one box finds everything.** The top bar's box offers grouped results as you type: verses, the forms
  of the word, the original words the KJV renders so, and your own pages. Enter opens the first.
- **C** (R5, R6): **the counts are the filter.**
  - Results open with the count in each book (`wb count`) as bars, and a click on a bar narrows to that book. The forms
    (`wb forms`) are chips above.
  - Near is set by clicking: a second word, and a stepper for how many words apart.

A, B and C can be combined: B for asking, A and C inside the results.

## Decisions (the person, 2026-11-11)

- **One box, both ways (B).** The top bar's box takes explicit commands, and it is also a loose search that suggests
  what the input could mean, as in R4. When the input reads as a command, that command is the first row of the
  dropdown, above Verses, so anyone who wants it gets it first.
- **Verses in results are shown whole**, never cut after a few lines.
- **Every use lives in the [Concordance](../concordance/README.md).** `wb uses` and its command in the box stay.
- **A and C both go inside the results.** The person wants to see how the counts by book look for a word used 500+
  times in a small pane (round 2, R9-R10).
- **Counts have a switch, Sections | Book by book** (the person, 2026-11-11; named so the same day). Sections open first, and the last choice is
  remembered. R9 and R10 show the switch in both positions.

## Round 2 (2026-11-11)

- **R7:** the box with the command first (`uses zeal`, what it does, ↵), then the suggestions.
- **R8:** the results pane with the filters, the counts by book and whole verses together.
- **R9:** a common word (heart: 830 times in 54 books, `wb count heart`) as one strip with every book a thin bar in its
  order. The strip keeps its width whatever the word; a click narrows to a book, and a drag narrows to a run of books.
- **R10:** the same counts in eight groups (Law ... Revelation) as rows with bars, each group opening to its books.
  It fits a narrow pane and reads as a list.

## Open questions

- Does every search open in the same pane (each a tab), or replace the last one?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-11 | R1-R6 | Today; A filters you click; B one box; C counts by book as the filter, near by clicking | B: one box, commands first then suggestions; verses whole; Every use in the Concordance; A and C inside (2026-11-11) |
| 2 | 2026-11-11 | R7-R10 | The command first in the box; filters, counts, whole verses together; counts for a common word as a strip or by group | — |

## Data the sheets show

All of it is fetched when the script runs:

| What | Made by |
|---|---|
| The verses with zeal (whole Bible, NT) | `wb search zeal [--scope nt]` |
| Counts by book, forms | `wb count zeal`, `wb forms zeal` |
| Near | `wb near zeal God --within 5` |
| The reader beside it | `design/content.json` (`num25`) through `build.desk_reader` |

## What the build must satisfy

Written once the person accepts a direction.

## Out of scope / later

- Notebook filtering (4463): the Notebook's own folder.
- Strong's entries and the word card (149b, in part): [concordance](../concordance/README.md) and the word sheet.
