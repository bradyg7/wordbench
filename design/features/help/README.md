# Help, the Guide and the manual

**State:** accepted (2026-11-13) · **Sheets:** `python design/features/help/help.py` writes `help.figcraft` and
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

## Round 2 (2026-11-13)

- **H6, H7** the Guide in the one menu: 15 cards in four groups (Reading 4, Looking up 3, Keeping 5, Making 3).
- **H8** Keys: the keyboard, a Find, the list with Change… on each row.
- **H9** no keyboard: Help reads Guide · Manual, cards without keys.
- **H10** the Notebook's ? opens the menu at Keeping.

## Open questions

- Are these 15 cards the right ones, and are their steps right? (round 2 review)
- Today Ctrl+Shift+J keeps a finding (`ui/src/panes.ts` KEYS); findings decided Ctrl+Shift+F. Does Ctrl+Shift+J go,
  or stay as a second key?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | see Directions | the first drawing | 2026-11-13: cards and keys, in the Settings menu |
| 2 | 2026-11-13 | H6-H10 | the one menu, 15 cards, Keys, no keyboard, ? | waiting |

## Data the sheets show

| File | Made by |
|---|---|
| `data/guide.json` | `wb guide` |
| `data/manual-uses.json` | `wb manual uses` |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

- [ ] Help is a heading in the Settings menu's section list (Guide, Keys, Manual); no separate window; one Find.
- [ ] Keys is the only keys section: a keyboard drawing, findable, changeable; hidden with no keyboard.
- [ ] The ? in each pane's head and F1 open the menu at the right Guide cards.
- [ ] Guide cards: task title, picture from the design sheet, steps, key and `wb` command; four groups.
- [ ] No Try button yet.
- [ ] The Guide's text stays in `wb guide`, so the window and the terminal say the same.
- [ ] The reader's place is kept.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
