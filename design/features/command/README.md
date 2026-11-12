# Top bar and the command box

**State:** exploring · **Sheets:** `python design/features/command/command.py` writes `command.figcraft` and
`command.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · Nothing here is built yet.

The slim top bar (the place and the command field) and what the field shows while you type, so the command language is never required (8353); also where kept commands and the app's full screen live.

## Leading design (2026-11-12)

Round 1 has not been reviewed, so every window still leads its part.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | C1 | |
| A: suggestions and chips | C2, C3 | |
| B: kept commands on the rail; the ⋯ menu | C4, C5 | |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 8353 | Users want clickable UI, not to type code or regex |
| 36d7 | The toolbar overloads; shortcuts go off screen |
| bc42 | The More button and the bar's settings need a design |
| 0e94 | Full screen for the whole app |

## Directions (round 1)

- **C1** today: the toolbar as built.
- **A** (C2, C3): the field suggests in plain words (each with its line in small type), then narrows with chips.
- **B** (C4, C5): kept commands move to the rail's foot; one ⋯ holds full screen, layout, theme and Settings.

## Decisions

None yet; round 1 waits for the person's review.

## Open questions

- Do kept commands also stay reachable as keys only (no icon)?
- Is the ⋯ the same menu as the rail's Settings, or apart?
- A's suggestions: which sources, in what order (places, look-ups, your study)?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | see Directions | the first drawing | waiting |

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25-10-13.json` | `wb text "Num 25:10-13"` |
| `data/manual-uses.json` | `wb manual uses` |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

Written once the person accepts a direction. Known already:

- [ ] Every suggestion is a line `wb parse` reads; `wb parse` is the check.
- [ ] The reader's place is kept.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
