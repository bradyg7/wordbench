# Trash

**State:** accepted by the person 2026-11-17 (ready to build): round 3 (T10-T14) accepted 2026-11-17; rounds 1-2
accepted 2026-11-13 (T5, T6, T8, T9) and built (commit `4f4f4d0`, 2026-11-13) · **Sheets:** `python design/features/trash/trash.py` writes `trash.figcraft` and
`trash.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)). What other tools get wrong, and so what this
folder avoids: [bible-software-complaints](../../research/bible-software-complaints.md) (theme 3: notes lost for good).

**Readiness: likely finished** (2026-11-16, the Notebook pass, by [ready-criteria](../ready-criteria.md)); the person
accepted round 3 on 2026-11-17, with TR-1 to TR-5 as written. Inferences first: TR-1 to TR-4 (below), each from a dated
decision or the spec.

- **1** T1, T5, T6, T8, T9 accepted by the person; T2-T4 and T7 off the board (the board shows T1, T5, T6, T8-T14 and
  nothing else, read from `trash.figcraft`). Round 3 proposes no new direction.
- **2** no open question; "Needs the person" is empty.
- **3** T11-T14 drawn (The real conditions table); T13's sheet reaches the window's bottom edge.
- **4** every unbuilt line names inputs and a result; "The reader's place is kept" is its own line.
- **5** existing commands named; `wb page rm <id> <id> …` and `wb trash restore <name> <name> …` named as required.
- **6** [overlaps](../overlaps.md) "Deleting: 7 days or destroyed" and "Choosing and deleting several pages" resolved
  (TR-2 with library L-13); [coverage](../coverage.md) gives `trash` to this folder alone.
- **7** agrees with `AGENTS.md` (7 days, Erase now, nothing else erased: TR-1) and `docs/SPEC.md:32` (TR-3).
- **8** the board holds only the Leading table's windows; Numbers 25:10-13 in T11, T12 comes from
  `data/num25-10-13.json` (`wb text`), equal byte for byte to marks' copy; nothing typed (`trash.py:24`).
- **9** no suggestion or commentary on the board. **10** no format change.

The person accepted round 3 (T10, T14, T11, T12, T13) on 2026-11-17; "Needs the person" held nothing to answer.

Deleting: a timed Undo, then 7 days in the Trash (the person's decisions, 2026-11-03, 2026-11-04 and 2026-11-13).
cf09 (2026-11-08) asked that deletes just be destroyed; 0ade asks for deleting many pages at once.

## Leading design (2026-11-16)

The board holds only these windows, grouped by part. Declined and superseded windows are in git history (commit
`b875cd4`).

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | T1 (kept by the person, 2026-11-13) | |
| Empty trash | T5 (two windows) | |
| The way to the Trash | T6, T8 | T7 (declined by the person, 2026-11-13) |
| Deleting a block (9ed7) | T9 | |
| Several pages at once (0ade) | T10 | T3 (by [library](../library/README.md) S32 for the choosing, and T10 for what follows; TR-2) |
| The real conditions | T11 (among other tabs), T12 (floating), T13 (narrow), T14 (years of study) | |
| Undo only; the Trash in Settings | | T2 (A) and T4 (B), declined by the person, 2026-11-13 |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| cf09 | Deletes should be destroyed, not go to the trash (declined, 2026-11-13) |
| 0ade | A delete-all for pages |
| 9ed7 | An easier way to delete a block |

## Decisions (the person)

- **2026-11-13:** deleting stays as it is today (T1): a 10-second Undo toast, then 7 days in the Trash, Erase now for one. "It gives a bit more leeway"; missing the toast must not be the end of the world. cf09 (destroy at once) is declined.
- **2026-11-13:** add an **Empty trash** button (erase everything in the Trash, asked to confirm).
- **2026-11-13 (round 2):** T6 and T8 for the way to the Trash; T5 with a **trash icon** (not an x) on each row that erases that one page, a real button that turns red on hover. T7 declined.
- **2026-11-13:** the way to the Trash is easy to find, but not prominent or in the way.

## Decisions (2026-11-16)

Each is **decided by overseer from existing decisions (inference)**, dated 2026-11-16. None changes what the person
accepted.

| # | Decision | Rests on |
|---|---|---|
| TR-1 | **Empty trash erases what the Trash lists and nothing else:** deleted pages and questions. Deleted findings, documents' records, layouts and plans also wait in `.trash/` but are not listed and are not erased. | `AGENTS.md` ("Nothing else is erased"); `wb trash empty` ("Other files in .trash stay") |
| TR-2 | **Choosing several pages is the library's** (S32: the selection and its bar). **What follows is the trash's:** every chosen page goes to the Trash, one toast for all with one Undo that puts all of them back, then each waits its 7 days (T10). T3, drawn under the declined direction A, is superseded. | The person's T1 decision; 0ade; overlaps "Choosing and deleting several pages" |
| TR-3 | **The Undo for several pages lasts 30 seconds; for one page, 10.** This is what `main` already does. | `docs/SPEC.md:32` (D1: "a 10-second single-page window and 30 seconds for batch") |
| TR-4 | **A large Trash** is grouped by the day of deletion with a count each, every group folded to its first rows with "Show all N", under a plain search field (T14). Nothing about the rows or the buttons changes. | index, "Every design is drawn in the real conditions" |
| TR-5 | **Deleting a block (T9) stays out of the Trash** (accepted). The questions that were open here are closed: the way to the Trash is T6 and T8; 9ed7 is T9; T3 is TR-2. | The person, 2026-11-13 |

## Needs the person

Nothing (none was open when the person accepted, 2026-11-17). No format changes; no rule changes.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | T1-T4 | today; A Undo only and several pages; B the Trash in Settings | 2026-11-13: T1 kept, A and B declined |
| 2 | 2026-11-13 | T5-T9 | Empty trash; the way to the Trash; deleting a block | 2026-11-13: T5, T6, T8, T9 accepted; trash icon asked for; T7 declined |
| 3 | 2026-11-16 | T10-T14; T2-T4, T7 off the board | several pages at once; the real conditions | Accepted by the person, 2026-11-17 |

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25-10-13.json` | `wb text "Num 25:10-13"` (the reader behind T11, T12 and T13) |

Scripture is fetched from the database, never typed. Names of pages and questions are a drawn sample.

## The real conditions

| Condition | Window |
|---|---|
| Among other tabs | T11 (the Trash as one tab of four beside the reader) |
| Floating | T12 (a 320 px floating pane beside the text) |
| Narrow | T13 (a 390 px phone; the question as a sheet over the bottom) |
| Years of study | T14 (214 waiting, grouped by day, folded) |

## What the build must satisfy

Lines marked *built* are in `4f4f4d0`; the others are what remains. Each is checked in a Rust test or the desk check
on a scratch study.

- [x] *Built.* Deleting a page shows a toast for 10 seconds with Undo; after it, the page is in the Trash with 7 days left, and `wb trash` lists it (T1, T8; `crates/wb-core/src/deletion.rs`).
- [x] *Built.* Empty trash asks "Erase N items now?" with the count, erases exactly the listed items on Erase N, and nothing on Cancel; `wb trash empty --days 0` does the same (T5).
- [x] *Built.* Each row in the Trash has a trash-icon button that erases that one item after asking: a pointer cursor, red on hover and on keyboard focus; Put back stays beside it (`wb trash erase <name>`, `wb trash restore <name>`) (T5).
- [x] *Built.* A muted Trash line with its count sits at the foot of the Notebook list, shown only when the count is above 0 (T6).
- [x] *Built.* The Undo toast says the page moved to the Trash and has a Trash button that opens it (T8).
- [x] *Built.* A block's grab handle opens Move up, Move down, Delete; Backspace in an empty block removes it; a 10-second Undo toast follows; `wb trash` does not list the block (`wb block rm --undo`, `wb block undo`) (T9).
- [ ] **Several pages.** Deleting 12 chosen pages shows one toast "12 pages moved to the Trash" with Undo and Trash for 30 seconds; Undo within it restores all 12 with their text, order and parents; after it `wb trash` lists 12 more, each with 7 days left; the Trash line's count rises by 12 (T10).
- [ ] **Empty trash leaves the rest.** With a deleted finding and a deleted layout also in `.trash/`, Empty trash erases the listed pages and questions, and both other files are still there (TR-1).
- [ ] **Among other tabs, floating, narrow.** As one tab of four the Trash keeps Empty trash in its head; floated at 320 px a row shows the name (ending with an ellipsis or wrapping), the days left, Put back and the trash button, all whole; at 390 px the question is a sheet reaching the bottom edge with Cancel and Erase N each at least 44 px high (T11, T12, T13).
- [ ] **Years of study.** With 214 items in a generated scratch Trash, the pane opens inside the list budget of `npm run measure`, shows the groups by day with counts and at most 5 rows each, "Show all 180" opens that group, and typing in the search field narrows the rows by name (T14).
- [ ] **The reader's place is kept.** With the reader at Numbers 25:11, opening the Trash from the toast, putting a page back, opening that page and closing it leaves the reader at Numbers 25:11 at the same scroll position.
- [ ] **Commands.** Existing: `wb trash`, `wb trash restore <name>`, `wb trash erase <name>`, `wb trash empty [--days N]`, `wb page rm <id>`, `wb page rm --all --yes`, `wb page undo <operation>`, `wb page deletions`, `wb page sweep`, `wb block rm`, `wb block undo`. Required and missing today: `wb page rm <id> <id> …` (several ids in one operation with one Undo; today it takes one id or `--all`), and `wb trash restore <name> <name> …`.
- [ ] **The study files.** No format changes: `.trash/` and `.trash/page-operations/` as today.

## Overlaps

[overlaps.md](../overlaps.md): "Deleting: 7 days or destroyed" (resolved by the person), "Choosing and deleting several
pages" (resolved, TR-2).
