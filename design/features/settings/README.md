# Settings, layouts and views

**State:** accepted (2026-11-13: round 2 tabs as planned, round 3 L3, TH1-TH2, F1-F3, C1′, C2, C3) · **Sheets:** `python design/features/settings/settings.py` writes `settings.figcraft` and
`settings.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · Nothing here is built yet.

The Settings pane (Reading, Notebook, Hover and cards, Theme, Layouts, Commands, Keys, Advanced), saved layouts, and views.

## Leading design (2026-11-12)

Round 1 reviewed 2026-11-13; round 2 draws every tab, today and planned, and the real conditions.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | S1 | |
| Italic words | Theme · planned | S2 (the same choice, kept per theme) |
| Scroll bars, full screen | none: not settings | S3 (declined 2026-11-13: a design choice for the whole app) |
| Layouts | L3 (accepted 2026-11-13) | L1, L2 (joined in L3); Layouts · planned (one row; the person, 2026-11-13: a grid) |
| Creating a theme | TH1, TH2 | |
| Settings found in the code | F1, F2 (Documents tab), F3 (candidates) | |
| A saved list | S5 | |
| Every tab | Reading, Theme, Notebook, Layouts, Commands, Keys, Study folder · planned | |
| The real conditions | C1′ split, reflowed; C2 floating and narrow; C3 years of study | C1 (text squeezed when split) |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 6bb0 | Italic words grey in night mode |
| e31a | Choose how italic words are drawn |
| e09e | Re-examine the Notebook's ⋯ settings |
| cd59 | Thin scroll bars that hide; no arrows |
| 25c6 | What does view mean? |
| 0e94 | Full screen for the app |

## Directions (round 3)

- Layouts in a grid, three across. L1 saves the window as it is; L2 builds one from a shape and parts; L3 (proposed)
  joins them: the grid's first tile, New layout, opens the builder from the window as it is.
- TH1: New theme: a name, a base to start from, colors in groups (text and paper, accent, italic words), a live
  reader preview. TH2: the five marks' colors with names and light and dark forms, contrast measured.
- Found in the code but not in Settings: read-aloud voice and speed, copying verses, the toolbar's buttons, and the
  look and theme of new documents (a Documents tab). Mark read after Listen (2dcf). Nothing exists for the
  concordance or trails: two candidates drawn as open questions.
- C1′: narrow, a pane reflows: sections become a menu, Find a search icon, each setting stacks; text never shrinks.

## Directions (round 2)

- Eight tabs become seven: Hover and cards joins Reading; Advanced becomes Study folder (the study folder, the Bible
  database, backups, Input), with Window size and the timings moved behind a developer switch.
- Reading: text size, version, cards on hover. Theme: italic words with a Genesis 1 preview, kept per theme.
- Notebook (e09e): four settings kept; Links, Notes on chapters and books, and Follow the reader proposed always on.
- Layouts: pictures of the panes, a key each, Save this layout. Commands: named, with keys. Keys: the list itself,
  findable and changeable.
- C1 Settings as a tab beside the Notebook while reading; C2 floating and narrow (sections become a menu); C3 a study
  of years (28 layouts, a find field, most used first).

## Directions (round 1)

- **S1** today.
- **A** (S2, S3): Italic words (italic, grey, grey italic, underlined, plain) with a Genesis 1 preview; thin scroll bars; the app's full screen.
- **B** (S4, S5): layouts as pictures; a view renamed “a saved list”.

## Decisions

- **2026-11-13 (the person):** not every design is a setting. Scroll bars are a design choice for the whole app (thin,
  hidden until used, no arrows: cd59), not a toggle; S3 is declined. Full screen is an action (⋯ menu, F11), not a
  setting.
- **2026-11-13 (the person):** layouts are a real setting, and the pictures direction (S4) is right.
- **2026-11-13 (the person):** the rest of round 3 accepted as drawn: TH1 and TH2 (new theme, the marks' colors), F1
  and F2 (the settings found in the code; a Documents tab), F3 (a click on a word opens its card or the Concordance;
  the trail keeps closed tabs today, 7 days or always), C1′ (a narrow pane reflows, text never shrinks).
- **2026-11-13 (the person):** layouts: L3, saving and creating together. One grid, three across; its first tile,
  New layout, opens the builder from the window as it is (Save at once = saving); right-click a layout to Edit, Rename,
  set its Key, Delete; Save this layout stays in the ⋯ menu as the one-step save.
- **2026-11-13 (the person, round 2 review):** layouts in a grid, not one row; weigh saving against creating a
  layout; show creating a theme; look for missing settings in the code; split beside the Notebook the text was mushed
  (round 3).
- **2026-11-13 (the person):** draw every tab as it is and as remodelled, and Settings among other tabs, floating,
  and with years of study data; these conditions now apply to every design folder (see the [index](../README.md)).

## Open questions

- Rename view in the window only, or in `wb` too?
- Which Notebook settings stay (e09e): a later round with [library](../library/README.md)?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | S1-S5 | the first drawing | 2026-11-13: S3 declined, S4 kept |
| 2 | 2026-11-13 | every tab today and planned; C1-C3 | every tab; the real conditions | 2026-11-13: grid, save/create, theme, more fields, C1 redraw |
| 3 | 2026-11-13 | L1-L3, TH1-TH2, F1-F3, C1′ | layouts, themes, fields from the code, the split | 2026-11-13: L3 and the rest accepted |

## Data the sheets show

| File | Made by |
|---|---|
| `data/gen1-1-3.json` | `wb text "Gen 1:1-3"` |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

Written once the person accepts a direction. Known already:

- [ ] Tabs: Reading, Theme, Notebook, Layouts, Commands, Keys, Study folder, Documents; Hover and cards folded into Reading; Advanced's window size and timings behind a developer switch.
- [ ] Reading: text size, version, cards on hover, read-aloud voice and speed, Mark read after Listen, copying verses, the toolbar's buttons, a click on a word opens (card or Concordance), the trail keeps (today, 7 days, always).
- [ ] Theme: New theme from a base, colors in groups, live preview; italic words kept per theme (dark defaults grey); the five marks' colors with light and dark forms and contrast measured.
- [ ] Notebook: Today's page, What it opens with, Places open in, Quick capture key; Links, Notes on chapters and books, Follow the reader always on.
- [ ] Layouts: one grid, three across; New layout first, opening the builder from the window; right-click Edit, Rename, Key, Delete.
- [ ] Keys: the keys listed, findable and changeable. Study folder: study folder, Bible database, backups, Input. Documents: look, theme, folder.
- [ ] Scroll bars thin and hidden until used, no arrows, everywhere (a design, not a setting); Full screen in the ⋯ menu and F11.
- [ ] Narrow (C1′, C2): sections become a menu, Find a search icon, rows stack; text never shrinks. Tested among other tabs, floating, narrow, and on a generated study of years (C3).
- [ ] `wb settings` reaches every new setting.
- [ ] The reader's place is kept.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
