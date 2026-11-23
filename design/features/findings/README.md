# Findings

> **Read [the principles](../principles/README.md) first** (2026-11-22): it says which of this folder's decisions stand under the new frame (desks, bubbles, the dock) and lists any that conflict, for the person to settle.

**State:** accepted (2026-11-13) · **Sheets:** `python design/features/findings/findings.py` writes `findings.figcraft` and
`findings.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · Nothing here is built yet.

The person's notes about the app (`findings/`, apart from the study): the box that writes one and the pane that lists them.

## Leading design (2026-11-12)

Round 1 reviewed 2026-11-13: A with B is accepted.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | | F1 (by A) |
| A: a small movable box; the pane | F2, F3 | |
| B: ! in the command field | F4 | |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 707d | The findings box should be draggable so it does not block |
| fe4d (2026-11-13) | Every design round checks findings; findings tagged by feature and given a state (seen, designed, coming soon, finished) |
| b737 (2026-11-08) | Findings can carry file attachments (the second half of b737) |

## Directions (round 1)

- **F1** today: a box in the middle.
- **A** (F2, F3): a small box in a corner, draggable, remembering where; the pane with Open / Handled.
- **B** (F4): `!` and words in the command field keep a finding.

## Accepted: tags (the person, 2026-11-12, for fe4d)

Proposed and accepted on 2026-11-12, and built: `tags` in wb-core (`findings::tag`, `list_tagged`), `wb finding tag`,
`wb finding untag`, `wb findings --tag`, chips and a tag filter in the pane. The pane's chip picker for adding a tag is
not built (round 2 draws it); tags are added from `wb`. `scripts/tag-findings.mjs` tags the existing findings from the
tables below each folder's "findings that touch it".

- **On disk.** A finding's header gains `tags: ["library", "marks"]`, a list of design folder names
  (`design/features/<name>`). A finding without `tags` reads as untagged; nothing else in the file changes. The rest
  of the header (`status` open or handled) stays as it is; the states fe4d names (seen, designed, coming soon,
  finished) are a separate decision.
- **Names.** Only names of folders listed in [coverage.md](../coverage.md) are accepted, so a tag never drifts from a
  folder. A folder renamed later renames its tags in one pass.
- **`wb`.** `wb finding tag <id> <folder>…` adds tags, `wb finding untag <id> <folder>…` removes them,
  `wb findings --tag <folder>` lists one folder's findings. `wb findings` shows the tags on each line.
- **The pane.** Each finding shows its tags as small chips under its text; a chip filter at the top narrows the list
  to one folder. Tagging in the pane is a chip picker of the folder names (drawn in round 2).
- **The 88 findings already written.** Tagged once, from the tables in each folder's "findings that touch it"
  section, by a `wb` run against a scratch copy first, then the real folder after `scripts/backup-study.ps1` and
  the person's go-ahead. The tables stay the record the designs read; the tags are the same facts on the finding.

## Decisions

- **2026-11-13 (the person):** A with B is accepted. The finding box is small, sits in a corner, can be dragged and
  remembers where it was left (F2); the Findings pane lists findings with Open / Handled (F3); `!` followed by words in
  the command field keeps a finding (F4). The box in the middle (F1) is retired.
- **2026-11-13 (the person):** Ctrl+Shift+F opens the finding box.

## Open questions

None.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | see Directions | the first drawing | 2026-11-13: A + B accepted |

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25-10-13.json` | `wb text "Num 25:10-13"` |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

- [ ] The box opens small, in a corner, never over the verse being read; it moves by its head and reopens where it
      was last left (F2; built for 707d, to be confirmed).
- [ ] The Findings pane lists findings with Open / Handled, their tags as chips, and the tag filter (F3).
- [ ] `!` followed by words in the command field keeps a finding without opening the box, and says it was kept (F4).
- [ ] `wb finding add` reaches F4's action.
- [ ] The reader's place is kept.
- [ ] Ctrl+Shift+F opens the finding box, and is listed with the other keys in Settings and Help.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
