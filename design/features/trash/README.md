# Trash

**State:** exploring · **Sheets:** `python design/features/trash/trash.py` writes `trash.figcraft` and
`exports/*.png` (it uses [kit.py](../kit.py)) · Nothing here is built yet.

Deleting: today a timed Undo, then 7 days in .trash (the person's decisions, 2026-11-03 and 04). cf09 (2026-11-08) asks that deletes just be destroyed; 0ade asks for deleting many pages at once. This round lays the choices out; it reopens nothing unless the person picks A.

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| cf09 | Deletes should be destroyed, not go to the trash |
| 0ade | A delete-all for pages |
| 9ed7 | An easier way to delete a block |

## Directions (round 1)

- **T1** today.
- **A** (T2, T3): Undo is the only way back (10 s), no Trash list; select and delete several pages.
- **B** (T4): the 7 days kept, the Trash moved to Settings › Study folder.

## Decisions

None yet; round 1 waits for the person's review.

## Open questions

- A reverses the 2026-11-03 decision; does the person want that?
- T3 goes with either: which pages are left out by default?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | see Directions | the first drawing | waiting |

## Data the sheets show

| File | Made by |
|---|---|
| none | the names on the sheets are a drawn sample |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

Written once the person accepts a direction. Known already:

- [ ] The Python app still opens the folder (`.trash/` kept as it is for legacy deletes).
- [ ] The reader's place is kept.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
