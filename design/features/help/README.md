# Help, the Guide and the manual

> **Read [the principles](../principles/README.md) first** (2026-11-22): it says which of this folder's decisions stand under the new frame (desks, bubbles, the dock) and lists any that conflict, for the person to settle.

**State:** up for redesign (the person, 2026-11-24); was: accepted (2026-11-13; steps come last) · **Sheets:** `python design/features/help/help.py` writes `help.figcraft` and
`help.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · Nothing here is built yet.

The Help pane: Guide (`wb guide`), Commands (`wb manual`) and Keys. 0050: it is plain text.

## Leading design (2026-11-12)

Round 1 reviewed 2026-11-13: A's cards and B's ? and keys, inside the Settings menu.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | | H1 (by the cards) |
| The Guide as cards | H2 | |
| Commands to try | H3 | the Try button postponed |
| ? beside the part | H4 (opens the menu at its card) | a separate help window |
| Keys | H5, as Settings' only Keys section | Settings' own Keys list |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 0050 | The help guide should look nicer and be friendlier |
| 76bf | Template help is unclear (asks for, puts them in) |

## Directions (round 1)

- **H1** today.
- **A** (H2, H3): the Guide as cards with pictures; commands as examples with Try.
- **B** (H4, H5): a ? in each pane's head opens its topic beside it; keys on a keyboard.

## Decisions

- **2026-11-13 (the person): one menu, two halves.** Help lives in the Settings menu (the centred menu over the
  dimmed window), under its own heading in the same section list: Settings (Reading, Theme, Notebook, Layouts,
  Commands, Study folder, Documents) and Help (Guide, Keys, Manual). There is no separate Help window. Manual is
  `wb manual`, named apart from Settings' Commands (the person's kept commands).
- **Keys is one section, Help's.** Drawn as Help's keyboard (H5), findable, and a key is changed there. Settings has
  no Keys of its own. With no keyboard (a phone or tablet), Keys is hidden until a key is pressed or a keyboard is
  attached, and the keys printed on cards hide the same way.
- **The ? in a pane's head** opens the menu at that pane's group of Guide cards. F1 opens it on the Guide.
- **Guide cards: one per thing done**, grouped Reading, Looking up, Keeping, Making. A card holds a task title, a
  picture exported from that feature's design sheet, two or three plain steps, its key and its `wb` command in small
  type. Today's topics (templates, shelf, views, threads, questions, words) become cards; the templates card says
  what a template asks for and what it fills in (76bf).
- **The Try button is postponed.**
- **2026-11-13 (the person, round 2 review): Help comes last.** The cards and Keys are liked and built now, but a
  card's steps are written only once the part it guides is finished, so the Guide is friendly and correct about the
  window as it then is. Until then each card names its task and says Coming soon. Cards carry no pictures and no `wb`
  commands. The Settings menu is smaller (1040 × 760 at most) so it sits in proportion over the window.
- **Changing a key** stays where it is set today (quick capture in Notebook, a layout's key in Layouts, a kept
  command's in Commands) until keys can be changed in Keys; Keys says where.

## Round 2 (2026-11-13)

- **H6, H7** the Guide in the one menu: 15 cards in four groups (Reading 4, Looking up 3, Keeping 5, Making 3).
- **H8** Keys: the keyboard, a Find, the list with Change… on each row.
- **H9** no keyboard: Help reads Guide · Manual, cards without keys.
- **H10** the Notebook's ? opens the menu at Keeping.

## Round 3 (2026-11-13)

- **H11, H12** the smaller menu; cards with an icon, the task and Coming soon; the Notebook's ? outlines Keeping.
- **H13** Keys in the smaller menu, a row lighting its keys.

## Open questions

- The cards' steps, written last, checked against the finished window (the 15 tasks may change by then).
- Change… in Keys: when keys can be changed in one place.
- Today Ctrl+Shift+J keeps a finding (`ui/src/panes.ts` KEYS); findings decided Ctrl+Shift+F. Does Ctrl+Shift+J go,
  or stay as a second key?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | see Directions | the first drawing | 2026-11-13: cards and keys, in the Settings menu |
| 2 | 2026-11-13 | H6-H10 | the one menu, 15 cards, Keys, no keyboard, ? | 2026-11-13: cards and keys liked; steps last |
| 3 | 2026-11-13 | H11-H13 | smaller menu, cards coming soon, Keys | built on feature/help |

## Data the sheets show

| File | Made by |
|---|---|
| `data/guide.json` | `wb guide` |
| `data/manual-uses.json` | `wb manual uses` |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

- [x] Help is a heading in the Settings menu's section list (Guide, Keys, Manual); no separate window; one Find.
- [x] The menu is at most 1040 × 760.
- [x] Keys is the only keys section: a keyboard drawing and the list, findable; a row lights its keys; hidden with no
      keyboard until a key is pressed.
- [ ] Keys: Change… on each row (waits for keys changeable in one place).
- [x] The ? in each pane's head and F1 open the menu at the right Guide cards.
- [x] Guide cards: icon and task, Coming soon, four groups; no pictures, no `wb` commands, no Try.
- [ ] Guide cards' steps, written last (Help comes last).
- [ ] The Guide's text stays in `wb guide`, so the window and the terminal say the same (when the steps are written).
- [ ] The reader's place is kept.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
