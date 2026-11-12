# Highlights and the palette

**State:** exploring · **Sheets:** `python design/features/highlights/highlights.py` writes `highlights.figcraft` and
`exports/*.png` · Nothing here is built yet.

Highlights and the palette were built before `design/features/` existed. This folder designs them for the first time.
It covers the colors, what a color can mean, layers, showing and hiding marks, and the light and dark forms of a color.
The click that opens the colors comes from [reader](../reader/README.md) (direction A), and threads from
[threads](../threads/README.md).

## Leading design (2026-11-12)

The board and `exports/` hold only these windows, grouped by part. Superseded windows are in git history (commit
`0d59600`, before the trim).

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Colors: today, names, light and dark | R1 (today), R2, R3 (names, the Highlights pane), R6, R7 (light and dark forms) | |
| Layers | H15-H19 (seeing the layers), R5 (which layer a new highlight goes in) | R4 (by H10 and H18) |
| When everything is colored | H8-H14 | |

## What exists today (in code, 2026-11-11)

- `crates/wb-core/src/store.rs`:
  - A highlight is `{id, anchor, color, quote, created}` in the chapter's highlights file.
  - A color is one of five names (yellow, green, blue, pink, orange) or a `#rrggbb`.
  - A new highlight on the same anchor replaces the old one.
- `settings/palette.json` holds up to eight saved custom colors, as one hex each. `use_palette_color` moves a color to the
  front.
- The named colors are tokens with a light, a dark and an e-ink form (`design/figlib.py` `hlYellow` …). A custom hex has
  one form only.
- `ui/src/marks.ts` draws the last highlight over each word. The Highlights switch hides every fill at once.
- `wb`: `hl set|clear|undo|list [--color] [--thread]`, `marks`, `palette`.

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 0590 (2026-11-09) | The highlights feature seems limited: hiding doesn't actually hide anything |
| b99f (2026-11-10) | Keep track of which verses have which color, so a color can stand for a topic; weigh how that clashes with threads and pages |
| 64f0 (2026-11-10) | Highlights and thread bars can be hidden, page and question marks cannot: design continuity |
| ad4c (2026-11-11) | Highlights layered by year of reading, with a toggle for which year's highlights show |
| 31da (2026-11-11) | A dark highlight picked in dark mode stays dark in light mode; colors should swap with the theme |

## Directions (round 1)

- **R1** is today, as built.
- **A** (R2, R3): **a color can carry a name.**
  - Each color beside a selection can have a name (Promises, Commands). The name is kept with the palette, not with
    each highlight, so renaming a color renames all its verses.
  - A Highlights pane lists every color with its name and count, opened to its verses in Bible order
    (`wb hl list --color`).
  - "Make a thread from these" turns a color's verses into a thread and keeps the highlights. That answers b99f's
    question about threads: a color is quick and has no text, while a thread has an order and a note.
- **B** (R4, R5): **highlights in layers.**
  - Each highlight belongs to a layer, by default a year of reading ("2026 reading"). It is a new field, `layer`, that
    the Python app passes over.
  - The Marks panel gives each layer an eye. Under the layers, one eye for every kind of mark: highlights, thread bars,
    page marks, questions and the margin (64f0, 0590).
  - The colors beside a selection show which layer they write to. On the first highlight after 1 January, the app asks
    once whether to start the new year.
- **C** (R6, R7): **every color has a light and a dark form.**
  - Settings › Colors shows each color as a pair, with e-ink beside it.
  - A custom color is saved as a pair too. You pick it in either mode, its other form is worked out (the same hue at the
    other lightness), and you can change it.
  - Old one-hex colors read as their light form.
  - R7 is the same chapter in dark mode.

A, B and C can go together.

## Open questions

- A: should a color's name live in `settings/palette.json` (one place, renamed once), or on each highlight?
- A: when a color has a name, is it a topic? Where does it stop and a thread begin? Should "Make a thread from these"
  exist at all?
- B: is a year of reading the right default layer? Or are layers named freely, with years only one use of them?
- B: should the eyes live in one Marks panel (as drawn) or with each kind? Reader's C has its own panel, so the two
  should become one.
- B: what does the new-year question do in a reading plan that crosses the year?
- C: should the dark form be worked out silently, or shown for you to accept when the color is added?
- How does `palette.json` keep both forms so the Python app still reads its colors? One way: `colors` stays light hexes
  and a new `dark` list sits beside it.

## Round 2 (2026-11-12): when everything is colored

Asked by the person after [marks](../marks/README.md) round 5 (M36): after years nearly every verse is colored, and a
color that is everywhere says nothing. Drawn on John 3:14-21 with a projected 18,000 highlights (not the person's data).

- **H8, the wallpaper:** every verse colored by five meanings across fifteen years; nothing stands out.
- **H9, A, a lens:** choose one named color (Promises); its verses stay full, every other highlight drops to a faint
  wash. Esc gives everything back.
- **H10, B, this year's reading only:** highlights belong to a year of reading (round 1, B); showing 2041 alone gives a
  clean page of what you marked this time through.
- **H11, C, older highlights fade:** this year's full, older ones paler with each year, never gone; one switch turns
  fading off.
- **H12, D, a quiet reading mode:** plain words, each verse's color as a short bar in the gutter; hover or select brings
  the color back onto the words. Reading / Study, one key (Q).
- **H13, E, many layers on one verse:** the words show the newest layer; a small stack in the gutter, one tick per
  layer; hover lists them with years and names.
- **H14, proposed together:** Reading mode by default (D); Study shows color on the words, this year's full and older
  faded (B + C), with the lens for one meaning (A); the stack (E) only where a verse has more than one layer. Nothing is
  deleted at any step.

### Open questions (round 2)

1. Reading mode by default, or Study? Does Reading mode hide thread lines and the pencil too, or only fills?
2. Fading (C): by year of reading (needs layers, B), or by the date each highlight was made (needs a date kept on each
   highlight, which today's highlights do not have)?
3. The lens (A): one color at a time, or several?
4. Is a gutter bar (D) enough to find a verse you highlighted while reading, or does it need the fill on hover only?

## Round 3 (2026-11-12): seeing the layers

The person asked how to see what the layers of their highlights look like. The app has no layers yet; this round
designs seeing them as a whole. Drawn on John 3:14-21 with a sample of four years of reading.

- **H15, two years side by side:** Compare layers shows the chapter twice, as marked in each chosen year, scrolling
  together, with a count under each and Change year.
- **H16, H17, a year slider:** a thin line of your years under the chapter title; dragging redraws the text as it stood
  at the end of that year (every highlight made up to then). Looking only; nothing changes. Esc returns to now (H17).
- **H18, your layers as a whole:** Highlights › Layers: each year of reading as a row with its count, its colors in
  proportion, the books it touched most and an eye; New layer, Merge two layers, Compare two years.
- **H19, one layer opened alone:** its highlights only in the reader, a band saying so with Show everything, and a list
  of its chapters to read a year of marking through again.

### Open questions (round 3)

1. The slider (H16) shows highlights *made up to* a year: does a highlight taken off later reappear when sliding back?
   That needs a record of when each was removed, as well as when it was made.
2. Is a layer always a year of reading, or can the person make layers of their own (a sermon series, a topic)?
3. Compare (H15): two years only, or the slider in each half?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-11 | R1-R7 | Today; A colors with names and a Highlights pane; B layers by year with an eye per layer and per kind of mark; C light and dark forms for every color | — |
| 2 | 2026-11-12 | H8-H14 | when everything is colored: a lens, this year only, fading, a quiet reading mode, many layers on a verse | waiting |
| 3 | 2026-11-12 | H15-H19 | seeing the layers: two years side by side, a year slider, the layers overview, one layer alone | waiting |

## Data the sheets show

| What | Made by |
|---|---|
| Joshua 1:1-9 | `wb text "Josh 1:1-9"` from the database, when the script runs |
| Named color forms | `design/figlib.py` tokens (`hlYellow` …) |
| Color names, counts, layers, custom colors | a drawn sample in the script, not anyone's study |

Scripture is fetched from the database and never typed. The top bar's place button reads "Numbers 25" because
`minimize.slim_bar` draws it fixed.

## What the build must satisfy

Written once the person accepts a direction.

## Out of scope / later

- Highlighting part of a Strong's entry (ea54): [concordance](../concordance/README.md).
- Italic words' color or style in the theme (e31a): Settings, layout, views.
- The click and right-click that open the colors: [reader](../reader/README.md).
