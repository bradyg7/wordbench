# Help, the Guide and the manual

**State:** exploring · **Sheets:** `python design/features/help/help.py` writes `help.figcraft` and
`help.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · Nothing here is built yet.

The Help pane: Guide (`wb guide`), Commands (`wb manual`) and Keys. 0050: it is plain text.

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 0050 | The help guide should look nicer and be friendlier |
| 76bf | Template help is unclear (asks for, puts them in) |

## Directions (round 1)

- **H1** today.
- **A** (H2, H3): the Guide as cards with pictures; commands as examples with Try.
- **B** (H4, H5): a ? in each pane's head opens its topic beside it; keys on a keyboard.

## Decisions

None yet; round 1 waits for the person's review.

## Open questions

- Pictures in the Guide: exports from these design folders, or drawn apart?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | see Directions | the first drawing | waiting |

## Data the sheets show

| File | Made by |
|---|---|
| `data/guide.json` | `wb guide` |
| `data/manual-uses.json` | `wb manual uses` |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

Written once the person accepts a direction. Known already:

- [ ] The Guide's text stays in `wb guide`, so the window and the terminal say the same.
- [ ] The reader's place is kept.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
