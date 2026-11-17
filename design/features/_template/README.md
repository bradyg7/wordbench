# <Feature name>

**State:** exploring · **Sheets:** `python design/features/<feature>/<feature>.py` writes `<feature>.figcraft` and
`<feature>.pdf` (the board, one vector page) · Nothing here is built yet.

One paragraph: what the feature is for, in the person's words, and which part of the app it touches.

## Leading design

The windows the board (and its PDF) holds, by part; superseded ones get a line saying what replaced them (see the
[index](../README.md), Keeping folders small).

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Part | A1 | |

## Decisions (the person, YYYY-MM-DD)

Dated, newest round last. Each says what was chosen and what was rejected, so the build does not reopen it.

- **Short name.** What was decided. What was rejected, and why if the person said.

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
|  |  |

## Open questions

- Question, and which round will answer it.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | YYYY-MM-DD | A1, A2 | ... | Decisions above, YYYY-MM-DD |

## Data the sheets show

| File | Made by |
|---|---|
| `data/<name>.json` | `wb ...` (the exact command) |

Scripture and lookups are fetched from the database, never typed.

## The real conditions

The board shows the part among other tabs, as a floating tab, narrow, and with years of study (see the
[index](../README.md)). Name the windows that show each:

| Condition | Window |
|---|---|
| Among other tabs | |
| Floating | |
| Narrow | |
| Years of study | |

## What the build must satisfy

Written once the person accepts a direction; each line is checkable, so the build's tests and the desk check can
follow it. Name the window (its tag, e.g. A1, on the board) that shows it.

- [ ] Behaviour, in the app's words. (A1)
- [ ] The `wb` command that reaches the same action (every core action has one).
- [ ] What happens to the study files, if anything (the study formats are this app's to shape; an old form is still read, and moving files to a new form is designed first).
- [ ] The reader's place is kept.

## Out of scope / later

- Things raised during the rounds that belong to another feature (link its folder).
