# Top bar and the command box

> **Read [the principles](../principles/README.md) first** (2026-11-22): it says which of this folder's decisions stand under the new frame (desks, bubbles, the dock) and lists any that conflict, for the person to settle.

**State:** up for redesign (the person, 2026-11-24); was: accepted (round 2, C13-C18; the person, 2026-11-13) · **Sheets:** `python design/features/command/command.py`
writes `command.figcraft` and `command.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · Building on
`feature/command`.

The slim top bar (the place and the command field) and what the field shows while you type, so the command language is never required (8353); also where kept commands and the app's full screen live.

## Leading design (2026-11-12)

Neither round has been reviewed, so every window still leads its part.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | C1 | |
| A: suggestions and chips | C2, C3 | |
| B: kept commands on the rail; the ⋯ menu | C4, C5 | |
| Round 2: the top bar with the trail line under it | C13 | C6 (browser tab row; one row cannot say which pane a tab is in) |
| The box keeps the line | C14 | C7 (drawn with the tab row) |
| Real conditions: beside panes and floating, years of study, narrow | C15, C16, C17 | C8-C11 (tab groups, split tabs, tab search) |
| The box popped off the bar (open question) | C18 | C12 |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 8353 | Users want clickable UI, not to type code or regex |
| 36d7 | The toolbar overloads; shortcuts go off screen |
| bc42 | The More button and the bar's settings need a design |
| 0e94 | Full screen for the whole app |
| c9a2 (2026-11-12) | Panes and tabs like browser tabs in the top bar, with the search bar as the command box |
| 3a9f (2026-11-12) | The command box keeps what was typed, to tweak and run again |
| c567 (2026-11-12) | The command bar can be moved or popped off the top bar |
| 252c (2026-11-12) | The command box suggests options and commands as a CLI does |
| 1bad (2026-11-12) | The command box finishes the sentence |

## Directions (round 1)

- **C1** today: the toolbar as built.
- **A** (C2, C3): the field suggests in plain words (each with its line in small type), then narrows with chips.
- **B** (C4, C5): kept commands move to the rail's foot; one ⋯ holds full screen, layout, theme and Settings.

## Round 2: the trail under the bar (2026-11-13)

A test design for c9a2, asked for by the person on 2026-11-13: move away from the toolbar as it is, keep the left rail.
A first try drew the tabs as a browser's tab row (C6-C12). The person asked how it works with several panes and the
reader: one row cannot say which pane a tab is in, and it makes the reader one tab among many. That try left the board
the same day before it was committed (only its record here remains), and the round was redrawn around the trail line minimize already chose
(I2, sittings N + O).

- **C13 the shape.** The top bar: back, forward, the place, the command box holding the front tab's line, and one More
  for the window (C5). The reader's tools (KJV, highlights, listen, find in chapter) sit at the box's end while the
  reader is in front. Under the bar, the trail line: the sitting, where it began, the way to here, forks marked. Panes
  keep their folder tabs; the reader stays in the middle. The toolbar goes, and with it its catalog, Customize
  toolbar…, Settings ▸ Toolbar and the buttons in `settings/toolbar.json` (36d7, bc42).
- **C14 the box keeps the line (3a9f).** Click the box and the front tab's line is there to change. Enter changes that
  tab (a step on the trail); Alt+Enter opens a new tab beside it (a fork). Round 1's suggestions (C2) open under it.
- **C15 among other panes, and floating.** The trail line runs over every pane: it is the order you went, not where a
  tab sits. Clicking a step brings its tab to the front wherever it is, restoring it if minimized. The box follows the
  pane last clicked.
- **C16 years of study.** A long sitting keeps where it began and the last few steps, folding the middle (“… 84”).
  The sitting chip lists earlier sittings, newest first, older days folded and compacted.
- **C17 narrow.** The place button folds into the box, the reader's tools into More, the middle steps into icons.
- **C18 (open question, c567).** The box dragged off the bar to float, and put back with a double-click.

Questions for the review:

1. Does the place button stay beside the box, or does the box show the place (as C17 does at every width)?
2. Do kept commands (C4, at the rail's foot) still have a place, or do the box's memory (C14) and its suggestions do
   their work?
3. The rail's Trail icon and the trail line both open the drawer: keep both?
4. The box popped off (C18): wanted, or not with this bar?

## Decisions

### Round 2 review (the person, 2026-11-13)

Round 2 (C13-C18) is accepted, and built on `feature/command` together with minimize's rail and trail.

1. **The place button stays** beside the box: it is a sufficient design.
2. **Kept commands get no place on the rail** for now.
3. **The rail's Trail icon and the trail line both open the trail drawer**, for now.
4. **The box can pop off the bar** (C18, c567): dragged by its grip it floats; double-clicking the grip puts it back.

### After trying the build (the person, 2026-11-13)

- **No grip.** The dotted grip at the box's start goes: the box's search icon is what drags it off the bar, and a
  double-click on the icon puts it back.

Round 1 is not reviewed. Round 2 uses its More menu for window things (C5); the suggestions in plain words (C2, C3)
wait for their own review and are not part of this build.

### Open questions answered, and round 1 reviewed (the person, 2026-11-16)

- **Kept commands** (C4) are reachable by their keys, and can also be available on the rail. (This changes round 2's
  answer 2, "no place on the rail for now": a kept command may now have a rail icon; its key stays.)
- **The ⋯ (More) menu merges into Settings**, for now: with the rail's Settings icon, ⋯ may no longer be needed.
  Settings' icon should probably be a gear.
- **Suggestions** (A, C2, C3): something that predicts the next word or offers the words that can come next; for a
  command, the fields it takes. In short: which books can be searched for, and where a command can go from what the
  person has typed. Sources and order are not settled.
- **Round 1:** C2 and C3 should both fit with C4 and C5; how C3 works with C2 is to be seen in the next round.

## Next round (round 3, to draw before building)

1. ⋯ folded into Settings: where each of More's items goes (Full screen, Layout, Theme, Text size, Help, Save chapter
   PDF), and the rail's Settings drawn as a gear. Check with [settings](../settings/README.md) and [minimize](../minimize/README.md).
2. Kept commands on the rail, beside their keys.
3. Suggestions: the next word or the words that can come next, a command's fields, the books, where a command can go;
   C2 and C3 drawn together. Sources and order to decide.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | see Directions | the first drawing | reviewed 2026-11-16: C2, C3 go to round 3 with C4, C5 |
| 2 | 2026-11-13 | C13-C18 (C6-C12 dropped the same day) | c9a2: the toolbar goes; the box keeps its line; the trail line under the bar; the real conditions | accepted 2026-11-13, built on `feature/command` |

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25-10-13.json` | `wb text "Num 25:10-13"` |
| `data/manual-uses.json` | `wb manual uses` |
| `data/ps106-28-31.json` | `wb text "Ps 106:28-31"` |
| `data/mal2-4-7.json` | `wb text "Mal 2:4-7"` |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

For round 2 (C13-C18), built with minimize's rail and trail (see [minimize](../minimize/README.md)'s build lines):

- [x] **No toolbar** (C13): the top bar holds back, forward, the place button, the command box and More, nothing else.
  The toolbar's catalog, Customize toolbar…, its drawer and Settings ▸ Toolbar are gone; More no longer lists "Hidden
  to fit" or "Not on your toolbar". `settings/toolbar.json` stays on disk untouched and `wb settings toolbar` still
  reads it; the window no longer uses it.
- [x] **The reader's tools at the box's end** (C13): KJV/YLT, Highlights, Listen and Find in chapter, shown while the
  reader is what was last clicked, hidden while a pane is. More holds Full screen (F11), Layout, Theme, Text size,
  Settings, Help and Save chapter PDF (C5).
- [x] **The box keeps the line** (C14, 3a9f): the box shows the front tab's line (the reader's place, or the line that
  opened the pane in front) and, focused, gives it back to change. Enter runs it as today; Alt+Enter runs it and opens
  its result as a new tab. The reader's place is kept.
- [x] **The box pops off** (C18, c567): dragged by its search icon (no grip, 2026-11-13) it floats and keeps its line;
  a double-click on the icon puts it back. Where it floats is kept in the window's storage.
- [x] **Narrow** (C17): under 900 px wide the place button hides (the box shows the place) and the reader's tools fold
  into More. Phone (compact) is unchanged.
- [x] Checked in the app (`npm run test:webkit`): among other panes, a floating tab, half width, and a scratch study the
  size of years of use.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
