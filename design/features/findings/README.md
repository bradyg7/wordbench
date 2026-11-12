# Findings

**State:** exploring · **Sheets:** `python design/features/findings/findings.py` writes `findings.figcraft` and
`exports/*.png` (it uses [kit.py](../kit.py)) · Nothing here is built yet.

The person's notes about the app (`findings/`, apart from the study): the box that writes one and the pane that lists them.

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 707d | The findings box should be draggable so it does not block |

## Directions (round 1)

- **F1** today: a box in the middle.
- **A** (F2, F3): a small box in a corner, draggable, remembering where; the pane with Open / Handled.
- **B** (F4): `!` and words in the command field keep a finding.

## Decisions

None yet; round 1 waits for the person's review.

## Open questions

- The box's key (Ctrl+Shift+F proposed)?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | see Directions | the first drawing | waiting |

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25-10-13.json` | `wb text "Num 25:10-13"` |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

Written once the person accepts a direction. Known already:

- [ ] `wb finding add` reaches F4's action.
- [ ] The reader's place is kept.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
