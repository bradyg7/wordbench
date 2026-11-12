# Word sheet, verse sheet and hover card

**State:** exploring · **Sheets:** `python design/features/words/words.py` writes `words.figcraft` and
`exports/*.png` (it uses [kit.py](../kit.py)) · Nothing here is built yet.

What a word, a verse reference and hovering show. The card is bloated with notes (2bc9), fixed in place (dfce, 149b), and a reference in a page should open the verse with its lookups (94a1).

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 2bc9 | Notes on the word bloat the card and show syntax |
| dfce | A reference's pop-up cannot be dragged or sized |
| 149b | Redesign notes & lookup; cards clickable and draggable |
| 94a1 | A verse opened from a note opens that verse only, with lookups |
| 2cd1 | Arrows through entries |
| efc3 | The edit button inside the card |

## Directions (round 1)

- **W1** today: the word sheet.
- **A** (W2, W3): a smaller card with a drag handle, a size corner, a pin, and ‹ › through entries; pages on the word as one count line.
- **B** (W4, W5): a reference opens the verse alone in a movable card with Interlinear / Strong's / Definitions; a quiet hover card.

## Decisions

None yet; round 1 waits for the person's review.

## Open questions

- Does a plain click on a word still open the card (the reader's open question)?
- W4 is reader R9 (a verse alone): one design or two?
- Does the pin make the card a floating pane (minimize's float) or keep it a card?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | see Directions | the first drawing | waiting |

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25-10-13.json, ps106-30-31.json` | `wb text` |
| `data/strong-H7065.json, strong-H7066.json` | `wb strong` |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

Written once the person accepts a direction. Known already:

- [ ] `wb word` / `wb verse` keep printing what the cards show; ‹ › is `wb strong` on the next number.
- [ ] The reader's place is kept.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
