# KJV+

**State:** exploring · **Shots:** `node design/features/kjv-plus/scene.mjs` draws them in the installed app
(`%LOCALAPPDATA%\bible-workbench-rs\app`, its own instance on a scratch copy of the study folder) into `scenes/` ·
Nothing here is built yet.

The KJV with each word's Strong's number shown in the text, as many students of Strong's read it (the person,
2026-11-16, while reviewing the [Concordance](../concordance/README.md); agreed to be its own design, not part of the
Concordance). It touches the reader only: the words, their numbers and how the numbers are turned on. The numbers
are the ones the reader already holds for each KJV word (`wb chapter`); nothing is added to the database or the study
folder.

## Leading design

Round 1 offers three ways to show the numbers and two ways to turn them on; none leads yet.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Showing the numbers | K1, K2 or K3 (to choose) | |
| Turning them on | K4 or K5 (to choose) | |

## Decisions (the person, 2026-11-16)

- **Its own design.** KJV+ is a view of the reader, not a part of the Concordance. A number in the text opens the
  same entry the Concordance shows (one entry, one place for it).

## Open questions

Round 1, asked 2026-11-16:

- **How are the numbers shown?** K1: small and colored right after each word (before its comma), the line stays a
  line. K2: small, raised above each word, so the words keep their order unbroken but every line is taller and short
  words widen to their number. K3: hidden until the pointer is on a word (and a tap on a phone); the page reads as the
  KJV. Or one of these as the default with another a setting?
- **How is it turned on?** K4: KJV+ is a reader version beside KJV and YLT, chosen where the version is chosen today
  (the KJV button at the box's end, and a reader pane's own KJV | YLT switch). K5: a toggle, `H#`, beside the KJV button among the reader's tools, which shows the numbers
  on whatever KJV is open. A version keeps one choice per reader pane and goes with the place; a toggle is one click
  and could later apply to the YLT if it ever carries numbers.
- **Words without a number** (*the*, *of*, words in italics the translators supplied): left bare, as drawn, or
  marked somehow?
- **Hebrew and Greek told apart** only by H and G, or by color too?
- **A click on a number:** the word sheet as today, or straight to the entry in the Concordance? (Clicking the word
  itself still selects it, as today.)
- **Documents and copy:** does Copy or a Word/PDF made while KJV+ is on carry the numbers? (Proposed: no, unless a
  document asks for them; the numbers are a way of reading.)
- **The command:** `wb text "Num 25:11" --version kjv+` (or `--strongs`) prints the verse with its numbers, so a
  terminal reaches the same view.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-16 | K0-K5 | three ways to show the numbers, two ways to turn them on, on Numbers 25 mid-study | open |

## Windows (round 1)

All on Numbers 25 at verse 10, the H7068 entry open on the left and the Notebook on the right, the scratch copy's
own highlights on the text.

| Window | Shot | What it shows |
|---|---|---|
| K0 | `scenes/k0-kjv-today.png` | the reader as it is today, for comparison |
| K1 | `scenes/k1-after-each-word.png` | the number after each word, small and in the accent color |
| K2 | `scenes/k2-above-each-word.png` | the number above each word, raised (ruby text: the words keep their spacing, the lines open up) |
| K3 | `scenes/k3-on-hover.png` | no numbers until the pointer is on a word (*zealous*, 25:11) |
| K4 | `scenes/k4-turned-on-as-a-version.png` | KJV+ chosen as a version: KJV, KJV+, YLT |
| K5 | `scenes/k5-turned-on-as-a-toggle.png` | an `H#` toggle on the bar, on |

Drawn from the build installed 2026-11-16 2:19 PM: the KJV button at the command box's end is the app's own; K4
turns it to KJV+ with a menu under it, K5 adds an `H#` toggle beside it. Each window is drawn in an instance of its
own, so a run never carries one window's state into the next.

## Data the sheets show

| File | Made by |
|---|---|
| `data/chapter-num25.json` | `wb chapter NUM 25` |

Scripture and numbers are the reader's own (and `wb chapter`), never typed. A number is drawn on the last word of a
run of words that render one original word (the `g` group).

## The real conditions

| Condition | Window |
|---|---|
| Among other tabs | K0-K5 (an entry and the Notebook open beside it) |
| Floating | not drawn yet (a reader pane in KJV+) |
| Narrow | not drawn yet (phone width; K2 costs the most room there) |
| Years of study | K0-K5 (the scratch copy's highlights and notes on the text) |

## What the build must satisfy

Written once the person accepts a direction.

- [ ] The numbers are the KJV words' own (`wb chapter`), never typed. (K1-K3)
- [ ] The `wb` command that prints a passage with its numbers.
- [ ] Nothing is written to the study files (a setting at most).
- [ ] The reader's place is kept when KJV+ is turned on or off.

## Out of scope / later

- The entry a number opens: the [Concordance](../concordance/README.md).
- Numbers in the YLT: the database has none today.
