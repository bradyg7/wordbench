# Trash

**State:** accepted (2026-11-13: T5, T6, T8, T9) · **Sheets:** `python design/features/trash/trash.py` writes `trash.figcraft` and
`trash.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · Nothing here is built yet.

Deleting: today a timed Undo, then 7 days in .trash (the person's decisions, 2026-11-03 and 04). cf09 (2026-11-08) asks that deletes just be destroyed; 0ade asks for deleting many pages at once. This round lays the choices out; it reopens nothing unless the person picks A.

## Leading design (2026-11-12)

Round 1 reviewed 2026-11-13: T1 stays; round 2 draws Empty trash and the way to the Trash.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | T1 (kept) | |
| A: Undo only; deleting several pages | | declined 2026-11-13 (T1 kept) |
| B: the 7 days kept, in Settings | | declined 2026-11-13 (where the Trash lives is round 2) |
| Empty trash | T5 | |
| The way to the Trash | T6, T8 | T7 (declined 2026-11-13) |
| Deleting a block (9ed7) | T9 | |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| cf09 | Deletes should be destroyed, not go to the trash |
| 0ade | A delete-all for pages |
| 9ed7 | An easier way to delete a block |

## Directions (round 2)

- **T5** Empty trash at the head of the Trash, asks first with the count.
- **T6** a muted Trash line with its count at the foot of the Notebook list, only when something waits.
- **T7** Trash in the Notebook menu and the command field, nothing in the list.
- **T8** the Undo toast names the Trash and opens it.
- **T9** a block's grab handle opens Move up, Move down, Delete; Backspace in an empty block removes it; Undo toast, no Trash.

## Directions (round 1)

- **T1** today.
- **A** (T2, T3): Undo is the only way back (10 s), no Trash list; select and delete several pages.
- **B** (T4): the 7 days kept, the Trash moved to Settings › Study folder.

## Decisions

- **2026-11-13 (the person):** deleting stays as it is today (T1): a 10-second Undo toast, then 7 days in the Trash, Erase now for one. "It gives a bit more leeway"; missing the toast must not be the end of the world. cf09 (destroy at once) is declined.
- **2026-11-13 (the person):** add an **Empty trash** button (erase everything in the Trash, asked to confirm).
- **2026-11-13 (the person, round 2):** T6 and T8 for the way to the Trash; T5 with a **trash icon** (not an x) on each row that erases that one page, a real button that turns red on hover. T7 declined.
- **2026-11-13 (the person):** design how the person reaches the Trash: easy to find, but not prominent or in the way.

## Open questions

- Where the way to the Trash sits (round 2 draws the choices).
- Does Empty trash also erase deleted findings and documents' records, or only pages?
- 9ed7 (deleting a block) has no window yet: round 2.
- T3 (selecting several pages) still stands apart from A: draw it again in round 2?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | see Directions | the first drawing | 2026-11-13: T1 kept, A and B declined |
| 2 | 2026-11-13 | T5-T9 | Empty trash; the way to the Trash; deleting a block | 2026-11-13: T5, T6, T8, T9 accepted; trash icon asked for |

## Data the sheets show

| File | Made by |
|---|---|
| none | the names on the sheets are a drawn sample |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

Written once the person accepts a direction. Known already:

- [ ] Undo stays a 10-second toast; a missed toast leaves the page in the Trash for 7 days.
- [ ] Empty trash asks to confirm, says how many it erases, and has a `wb` command.
- [ ] Each row in the Trash has a trash-icon button that erases that one item (asks first): a pointer cursor, red on hover and on keyboard focus; Put back stays beside it.
- [ ] A muted Trash line with its count sits at the foot of the Notebook list, shown only when something waits (T6).
- [ ] The Undo toast says the page moved to the Trash and has a Trash button that opens it (T8).
- [ ] A block's grab handle opens Move up, Move down, Delete; Backspace in an empty block removes it; an Undo toast follows; blocks never go to the Trash (T9).
- [ ] The reader's place is kept.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
