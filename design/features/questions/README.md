# Questions

**State:** exploring · **Sheets:** `python design/features/questions/questions.py` writes `questions.figcraft` and
`questions.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · Nothing here is built yet.

Questions are written three ways today: a trail at a place, an Inbox question, and a callout in a page; `wb question list` already joins them. This round asks how they are asked, seen and answered in the window.

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 38c2, 7d00 | Everything a page; questions as a kind of block |
| c7ab | Retire the Inbox |

## Directions (round 1)

- **Q1** today: three kinds.
- **A** (Q2, Q3): one Questions list by place; asking writes in the reader's margin (reader C).
- **B** (Q4, Q5): every question is a callout line in a page (the verse's page or today's); answering adds an optional line under it.

## Decisions (the person, 2026-11-12)

- **B, plus a list view.** A question is stored only as a callout line in a page (`> [!question]`, `> [!done]`): one
  way to ask, answer and delete, as [library](../library/README.md) decided. A question at a verse goes in that verse's
  page, made if there is none. Old trails and Inbox questions are folded into pages once, with the person's go-ahead
  (`wb question fold`).
- **Every open question can still be seen as one list**, but as a filtered view (a saved list, or a section of the
  Library), not a Questions tab of its own. A (trails kept at a verse, a Questions tab) is rejected.

## Open questions

- **Where the list lives:** settled 2026-11-12 in [marks](../marks/README.md): a filter of the Library's search, and a
  saved list in a page (Q6). Q7 (a Library section) is dropped.
- **A question with no place:** the page in front, asking which page when none (Q8), or one page named Questions (Q9),
  or both? Today is never needed in either. (round 2)
- **Asking from the reader:** the margin line writes a callout into the verse's own page, made if needed (Q10, Q11).
  Accept as drawn? (round 2)

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | Q1-Q5 | today; A one list and the margin; B lines in pages | B plus a list view (2026-11-12) |
| 2 | 2026-11-12 | Q6-Q11 | the list as a saved list or a Library section; a question with no place; asking into the verse's page | waiting |

## Round 2 (2026-11-12)

- **Q6:** the list as a saved list block (`notebook questions open`) in any page; a page holding only it is the old tab, by choice.
- **Q7:** a Questions section in the Library drawer, grouped by book, nothing to set up.
- **Q8:** a question with no place goes in the page in front; with none open, the field asks which page.
- **Q9:** one page named Questions, made the first time, takes questions with no place and no page.
- **Q10, Q11:** asking in the reader's margin writes the callout at the end of the verse's page (made if none); the margin shows that line.

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25-6-13.json` | `wb text "Num 25:6-13"` |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

Written once the person accepts a direction. Known already:

- [ ] Same files: trails and callouts as today; B's fold uses the existing `wb question fold`.
- [ ] The reader's place is kept.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
