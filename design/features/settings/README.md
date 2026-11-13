# Settings, layouts and views

**State:** exploring · **Sheets:** `python design/features/settings/settings.py` writes `settings.figcraft` and
`settings.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · Nothing here is built yet.

The Settings pane (Reading, Notebook, Hover and cards, Theme, Layouts, Commands, Keys, Advanced), saved layouts, and views.

## Leading design (2026-11-12)

Round 1 has not been reviewed, so every window still leads its part.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | S1 | |
| A: italic words; scroll bars and full screen | S2, S3 | |
| B: layouts as pictures; a saved list | S4, S5 | |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 6bb0 | Italic words grey in night mode |
| e31a | Choose how italic words are drawn |
| e09e | Re-examine the Notebook's ⋯ settings |
| cd59 | Thin scroll bars that hide; no arrows |
| 25c6 | What does view mean? |
| 0e94 | Full screen for the app |

## Directions (round 1)

- **S1** today.
- **A** (S2, S3): Italic words (italic, grey, grey italic, underlined, plain) with a Genesis 1 preview; thin scroll bars; the app's full screen.
- **B** (S4, S5): layouts as pictures; a view renamed “a saved list”.

## Decisions

None yet; round 1 waits for the person's review.

## Open questions

- Rename view in the window only, or in `wb` too?
- Which Notebook settings stay (e09e): a later round with [library](../library/README.md)?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | see Directions | the first drawing | waiting |

## Data the sheets show

| File | Made by |
|---|---|
| `data/gen1-1-3.json` | `wb text "Gen 1:1-3"` |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

Written once the person accepts a direction. Known already:

- [ ] `wb settings` reaches every new setting.
- [ ] The reader's place is kept.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
