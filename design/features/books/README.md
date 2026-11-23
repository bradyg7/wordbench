# BDB and Webster's 1913 as books

> **Read [the principles](../principles/README.md) first** (2026-11-22): it says which of this folder's decisions stand under the new frame (desks, bubbles, the dock) and lists any that conflict, for the person to settle.

**State:** exploring · **Sheets:** `python design/features/books/books.py` writes `books.figcraft` and
`books.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · Nothing here is built yet.

The two lexicons the rail already names (minimize round 5), opened as books you page through instead of a lookup in a tab. Touches the rail, the word card ([words](../words/README.md)) and the Concordance ([concordance](../concordance/README.md)).

## Leading design (2026-11-12)

Round 1 has not been reviewed, so every window still leads its part.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | K1 | |
| A: each lexicon as a book | K2, K3 | |
| B: one card with three sources | K4, K5 | |
| Links between entries; Webster's as a book | K6, K7 | |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 2cd1 | Arrows through Strong's entries, as Blue Letter Bible |
| b537 | A full directory of Hebrew and Greek words |
| ea54 | Highlight part of a Strong's entry |
| f73d | References to other words inside an entry |
| 66b8 | Webster's not yet on the card (dictionary.db) |

## Directions (round 1)

- **K1** today: an entry in a tab.
- **A** (K2, K3): each lexicon a book: one entry to a page, ← → to the next, an index by number or letter.
- **B** (K4, K5): one word card holding Strong's, BDB and Webster's as tabs; marks on part of an entry.
- **K6** entries that name other numbers as links; **K7** Webster's as the same book.

## Decisions

None yet; round 1 waits for the person's review.

## Open questions

- A or B, or both (the book from the rail, the card from the reader)?
- Where a mark on an entry is kept: `highlights` keyed by Strong's number (a new key the Python app passes over) or a page?
- Does the index belong here or in the Concordance's own contents?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | see Directions | the first drawing | waiting |

## Data the sheets show

| File | Made by |
|---|---|
| `data/bdb-H7065.json, bdb-H7066.json` | `wb bdb H7065 / H7066` |
| `data/strong-H7065.json` | `wb strong H7065` |
| `data/webster-zealous.json, webster-zeal.json` | `wb word-define zealous / zeal` |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

Written once the person accepts a direction. Known already:

- [ ] `wb bdb` / `wb word-define` gain --next / --prev (or a `wb lexicon page`), so paging is reachable from a terminal.
- [ ] The reader's place is kept.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
