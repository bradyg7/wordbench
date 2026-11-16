# Lessons and documents (Word, PDF, Present)

**State:** exploring · **Sheets:** `python design/features/documents/documents.py` writes `documents.figcraft` and
`documents.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · Nothing here is built yet.

Documents made from a thread, a passage, a lesson or a page; 868e asks for an in-depth design and a builder like the page templates.

## Leading design (2026-11-12)

Round 1 has not been reviewed, so every window still leads its part.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | D1 | |
| A: a builder from a page; the viewer | D2, D3 | |
| B: Looks; where files go | D4, D5 | |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 868e | Scrap the old Word and slide designs; design them in depth; a document template builder |
| a148 | ← → through slides in the viewer |
| 2089 | Show in folder goes to the wrong place |

## Directions (round 1)

- **D1** today: the Documents pane.
- **A** (D2, D3): a builder from a page's parts (`wb craft parts`), each part choosing what it becomes; a viewer that pages with ← → and Present.
- **B** (D4, D5): Looks chosen from pictures; a line after Make saying where the file went.

## Decisions

None yet; round 1 waits for the person's review.

## Open questions

- Is a kept build a new kind of template (a `documents/` record) or a page template?
- 2089: today the real study's documents go to the Python app's folder; should that change?
- Lessons (`lessons/*.md`): kept as a source, or become pages?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | see Directions | the first drawing | waiting |

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25-11-13.json` | `wb text "Num 25:11-13"` |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

Written once the person accepts a direction. Known already:

- [ ] Every verse in a made file is still checked after it is made.
- [ ] The builder is reachable as `wb craft … ` with the chosen parts.
- [ ] The reader's place is kept.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
