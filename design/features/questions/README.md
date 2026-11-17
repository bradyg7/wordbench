# Questions

**State:** exploring (round 3 drawn 2026-11-16, for the person's look) · **Sheets:** `python design/features/questions/questions.py` writes `questions.figcraft` and
`questions.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · The new design is not built; `wb question …`
and the callout line exist today. What other tools get wrong, and so what this folder avoids:
[bible-software-complaints](../../research/bible-software-complaints.md) (theme 5: many steps for one answer; theme 8:
the place lost).

**Readiness: likely finished** (2026-11-16, the Notebook pass, by [ready-criteria](../ready-criteria.md); never
"accepted", which only the person says). Inferences first: QN-1 to QN-7 (below); the one that chose between drawn
windows is QN-3 (Q8 over Q9).

- **1** B chosen by the person; A (Q2, Q3), Q7, Q9, Q10, Q11 superseded and off the board (the board shows Q1, Q4,
  Q5, Q6, Q8, Q12-Q15 only, read from `questions.figcraft`).
- **2** no open question left; "Needs the person" 1 (the one-time fold) is a move of the person's files, with a
  recommendation, and the design is complete without it (QN-6).
- **3** Q12-Q15 drawn; Q14's sheet reaches the bottom edge (looked at on the rendered board).
- **4** every line names inputs and a result; "The reader's place is kept" is its own line.
- **5** existing commands named; `wb margin add … --question` (marks) and `wb find --kind question --open` (library)
  named as required.
- **6** [overlaps](../overlaps.md) "Questions in the Library", "Where questions live", "Today's page", "Saved views",
  "The reader's margin" and "Places" agree or are resolved; [coverage](../coverage.md) gives `question`, `questions`,
  `trail` to this folder.
- **7** agrees with `AGENTS.md` (a question is a callout line) and library's "Today is optional" (QN-3).
- **8** the board holds only the Leading table's windows; no chip in Q6's head; Numbers 25:6-13 from
  `data/num25-6-13.json` (`questions.py:17`); question rows are placeholders.
- **9** the app writes no answer and offers none (QN-5). **10** no new format here; the margin's file is marks'
  "Needs the person" 1.

Depends on: questions in a margin note (Q4's right half) are built only after marks' "Needs the person" 1.

For the person, to accept: Q4 (a line in a page or a margin), Q5 (answering), Q6 (the list), Q8 (no verse), then
Q12-Q15. Q1 is today, for comparison.

Questions are written three ways today: a trail at a place, an Inbox question, and a callout in a page;
`wb question list` already joins them. This folder says how they are asked, seen and answered in the window.

## Leading design (2026-11-16)

The board and its PDF hold only these windows, grouped by part. Superseded ones are cut from the script; their
drawings are in git history (commits `0d59600`, `b875cd4`).

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | Q1 (as built, for comparison) | |
| A question is a line, in a page or in a verse's margin | Q4, Q5 (B, chosen by the person) | Q2, Q3 (A, rejected by the person) |
| The list | Q6 (a saved list in a page); the Library's search set to Questions ([marks](../marks/README.md) M21, [library](../library/README.md) S21) | Q7 (a Library section, dropped by the person, 2026-11-12) |
| A question with no verse | Q8 | Q9 (a Questions page made by the app; QN-3) |
| Asking from the reader | [marks](../marks/README.md) M27 (writing in the margin asks where) | Q10, Q11 (by the margin decision and M27) |
| The real conditions | Q12 (among other tabs), Q13 (floating), Q14 (narrow), Q15 (years of study) | |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 38c2, 7d00 | Everything a page; questions as a kind of block |
| c7ab | Retire the Inbox |

## Decisions (the person, 2026-11-12)

- **B, plus a list view.** A question is stored only as a callout line (`> [!question]`, `> [!done]`): one way to ask,
  answer and delete, as [library](../library/README.md) decided. Old trails and Inbox questions are folded into pages
  once, with the person's go-ahead (`wb question fold`).
- **Every open question can still be seen as one list**, as a filtered view, not a Questions tab of its own. A (trails
  kept at a verse, a Questions tab) is rejected.
- **Where the list lives** (in [marks](../marks/README.md)): a filter of the Library's search, and a saved list in a
  page (Q6). Q7 (a Library section) is dropped.
- **A page has no place; the margin is the verse's page** ([marks](../marks/README.md), 2026-11-12). So "a question at
  a verse goes in that verse's page" now reads: it is a margin note beside the verse, or a line in a page that names
  the verse.

## Decisions (2026-11-16)

Each is **decided by overseer from existing decisions (inference)**, dated 2026-11-16.

| # | Decision | Rests on |
|---|---|---|
| QN-1 | **A question line lives in a page, or in a margin note beside a verse**: the same line, the same look, one list (Q4). | The person's B; marks ("the margin is the verse's page"; "a jot can be a question") |
| QN-2 | **Asking from the reader is marks' M27**: writing in the margin asks "Leave in the margin" or "Add to a new page"; a line that starts with `?`, or Make it a question in the note's menu (marks M32), makes it a question. Questions draws no window of its own for it. | marks, 2026-11-12 (the person: "Writing in the margin asks") |
| QN-3 | **A question with no verse goes in the page in front; with no page open, the field asks which page** (the last pages written in, or A new page) (Q8). Q9 is dropped: a page made and named by the app is one more special page, after the Inbox and Today were retired. Today's page is never needed. | library ("Today is a page you can choose to show"; the Inbox goes); c7ab |
| QN-4 | **The list has two doors and one engine:** the Library's search with its field menu set to Questions (marks M21), and a saved list block in any page (Q6; "saved list" is [settings](../settings/README.md) S5's word). Both run the same line (`wb view run "notebook questions open"`). Its head is one line of plain text and a pencil; no chips (marks, round 1 review: "chips as filters are not liked"). | marks decision 4; settings S5; library L-8 |
| QN-5 | **Answering** is a tick on the line (`> [!done]`) and an optional line of the person's own under it (Q5). The app writes no answer and offers none. | The person's B; `AGENTS.md` (no interpretation) |
| QN-6 | **Old trails and Inbox questions are read as they are** and appear in the list until the person has them folded; nothing is moved by the build. A click on an old trail shows the trail (library L-4, bc07). The fold is the person's go-ahead ("Needs the person" 1). | The person, 2026-11-12; `AGENTS.md` (a move needs the go-ahead) |
| QN-7 | **A large list** is grouped by book with counts in the Library's search and shows its first 20 rows with "Show all N" in a saved list block (Q15). | index, "the real conditions" |

## Needs the person

1. **Folding the old trails and Inbox questions, once.** Recommended: yes, together with [marks](../marks/README.md)'
   one-time move (its "Needs the person" 2), not before: a trail at a verse becomes a question margin note at that
   verse, an Inbox question becomes a line in a page the person names. Tried on a scratch copy first, after a hashed
   backup (`scripts/backup-study.ps1`), with a list of what would move shown before anything is written. Main risk:
   doing it before the margin's file form is approved would move the same questions twice. The design is complete
   without it: Q4-Q15 work with the old forms still on disk (QN-6).

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | Q1-Q5 | today; A one list and the margin; B lines in pages | B plus a list view (the person, 2026-11-12) |
| 2 | 2026-11-12 | Q6-Q11 | the list as a saved list or a Library section; a question with no place; asking into the verse's page | Q7 dropped by the person (2026-11-12, in marks); Q10, Q11 superseded by marks M27; Q8 over Q9 by the overseer (QN-3, 2026-11-16) |
| 3 | 2026-11-16 | Q4-Q6, Q8 redrawn; Q12-Q15 | a line in a page or a margin; the list without chips; the real conditions | For the person's look |

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25-6-13.json` | `wb text "Num 25:6-13"` |

Scripture is fetched from the database, never typed. Names of pages are a drawn sample; the question sentences are
samples of what a person might ask, and rows drawn in bulk read "A question of yours, as you wrote it".

## The real conditions

| Condition | Window |
|---|---|
| Among other tabs | Q12 (the list's page as one tab of four beside the reader; a row answered in place) |
| Floating | Q13 (the list as a 320 px floating pane) |
| Narrow | Q14 (a 390 px phone: which page, as a sheet over the bottom) |
| Years of study | Q15 (640 questions, 212 open: the Library's search by book; the saved list's first rows) |

## What the build must satisfy

Each line is checked in a Rust test or the desk check, on a generated scratch study.

- [ ] **One line.** `/?` or `?` at the start of a block in a page writes `> [!question] text` in that page's file and nothing else; the same in a margin note writes the same line in the margin's file (Q4; the margin's file form is marks').
- [ ] **Answering.** A tick on a question changes its line to `> [!done]` and nothing else in the file; an answer typed under it is saved as the paragraph after the callout; unticking restores `> [!question]` and keeps the answer (Q5; `wb question answer <page>#<n>`, `--open`).
- [ ] **No verse, a page in front.** With the page "Tuesday study" in front, `? text` in the command field adds the line as that page's last block (Q8; `wb question add <page id> "text"`).
- [ ] **No verse, no page.** With no page open, the field lists the 3 pages last written in and "A new page"; choosing one adds the line there; Esc writes nothing (Q8).
- [ ] **No Questions tab, no Inbox, no app-made page.** After asking 5 questions in each way, the study folder has no new file except the pages and margin files the person chose (compare the file list).
- [ ] **The list.** A saved list block with the line `notebook questions open` lists every open question from pages, margin notes, old trails and the old Inbox, each row saying where it lives ("Numbers 25:11 · in the margin", "in the page Phinehas"); it equals `wb question list` row for row. A tick in the list changes the line in its own file (Q6).
- [ ] **The Library's door.** The Library's search with its menu set to Questions · open lists the same rows as the saved list (Q15, marks M21, library S21).
- [ ] **No chips.** The list's head is one line of text ("Questions · open · every place") and a pencil that edits the line; there is no pill or chip in it (Q6).
- [ ] **Old forms are read, not moved.** With 3 trails and 2 Inbox questions in the scratch study, all 5 are in the list, a click on a trail opens it as it is, and no file changes until `wb question fold` is run (QN-6).
- [ ] **Among other tabs, floating, narrow.** As one tab of four the list answers a row in place without changing tab; floated at 320 px a question wraps and its where-line and tick stay whole; at 390 px "Write the question in:" is a sheet reaching the bottom edge (Q12, Q13, Q14).
- [ ] **Years of study.** With 640 questions (212 open) the Library's search shows them grouped by book with counts inside the search budget of `npm run measure`; a saved list block shows 20 rows and "Show all 212" (Q15).
- [ ] **The reader's place is kept.** From Numbers 25:11, asking in the margin, opening the list, opening a question's page from the list and going back returns the reader to Numbers 25:11 at the same scroll position; a click on a row's reference opens that verse and the back button returns to the list row it came from.
- [ ] **Commands.** Existing: `wb question list [--at] [--status]`, `wb question add`, `wb question answer [--open]`, `wb question fold`, `wb question unfold`, `wb view run`, `wb block view`, `wb block set` (edit a question), `wb block rm` (delete one); `wb trail …`, `wb questions`, `wb note question`, `wb note answered` stay for the old forms. Required and missing today: asking into a margin (`wb margin add "Num 25:11" "text" --question`, named in [marks](../marks/README.md)), and a kind filter on the Library's search (`wb find --kind question --open`, named in [library](../library/README.md)).
- [ ] **The study files.** No new format here: the callout line as today. The margin's file is marks'.

## Out of scope / later

- The margin, its file and M27: [marks](../marks/README.md). The Library's search and the side list:
  [library](../library/README.md). The command field's suggestions: [search](../search/README.md),
  [command](../command/README.md).

## Overlaps

[overlaps.md](../overlaps.md): "Questions in the Library", "Where questions live", "Today's page", "Saved views",
"The reader's margin", "Places: a page's anchor vs tethers".
