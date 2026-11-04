# Phase 2b, step 4: the design round, for review

2026-11-04. The sheets for [PLAN-phase2b.md](PLAN-phase2b.md) step 4, shaped by the person's notes of 2026-11-03 and 11-04
([phase2-results.md](phase2-results.md) sections 11 and 12). Nothing here is built. The person picks a design (or a mix)
where there are several, and accepts or changes each sheet; step 5 builds what is accepted.

**How they are made:** with FigCraft, from scripts, as the phase 2 sheets were. `design/` was copied into this repository
from the Python repository's branch `claude/design-layouts-e1b1df` (commit 321443b; that repository was only read), less
its screenshots of the Python app. The new round is `design/phase2b.py` → `design/phase2b.figcraft` (one page, every design on one board) and
`design/exports/phase2b/`; the phase 2 sheets (`design/build.py`) are unchanged. `python design/phase2b.py` rebuilds it in
about 20 seconds. Scripture on the sheets comes from `design/content.json` (fetched from the database); the notes shown are
the Phinehas demo's. Scripture is drawn in Merriweather, FigCraft's built-in serif; the app uses Literata.

**Everything on one board:** [all-designs.png](../design/exports/phase2b/all-designs.png) (the file's one page, *All
designs*, at half size). Each section on its own: [Notebook](../design/exports/phase2b/notebook.png) · [Reading plans](../design/exports/phase2b/reading-plans.png)
· [Dock and views](../design/exports/phase2b/dock-and-views.png) · [Threads, Help, words](../design/exports/phase2b/threads-help-words.png)
· [Shelf and settings](../design/exports/phase2b/shelf-and-settings.png). Open `design/phase2b.figcraft` in FigCraft to look
closer: it is one page, so the whole round can be zoomed and panned in one place.

## 1. The Notebook, from the start (note `09ef`)

Three designs. Each keeps quick capture (the pen, or **Ctrl+J** anywhere: note `e998`) and keeps the files readable by hand.

| Design | Windows | In short | The files |
|---|---|---|---|
| **A. A page for each day** | [A1 today's page beside the reader](../design/exports/phase2b/a1-today-s-page-beside-the-reader.png), [A2 writing mode](../design/exports/phase2b/a2-writing-mode-the-page-in-the-middle.png) | The Journal is a writing page per day, like a diary. A paragraph tied to a verse has a place chip and also shows at its verse. Writing mode puts the page in the middle and the reader in a column | **New:** one Markdown file per day, `notes/_journal/<day>.md`; a paragraph with a place is also saved as a placed note |
| **B. Notes like documents** | [B1 the list and the editor](../design/exports/phase2b/b1-the-list-and-the-editor.png), [B2 quick capture](../design/exports/phase2b/b2-quick-capture-anywhere-ctrl-j.png) | As in Apple Notes or Obsidian: a list (Today, Inbox, Questions, All, a search) and the open note as a full editor with a title, places and threads as chips | **Unchanged:** one note per file, as now; the first line is its title |
| **C. A page for each chapter** | [C1 Numbers 25, your page](../design/exports/phase2b/c1-numbers-25-your-page.png), [C2 the tray](../design/exports/phase2b/c2-the-tray-thoughts-not-placed-yet.png) | Beside Numbers 25, your page for Numbers 25: notes at verses as blocks in the chapter's order, free writing between them; turning the chapter turns the page. Unplaced thoughts wait in a tray | **Unchanged:** each block is a placed note; free writing is a note on the chapter |

A and C can be mixed (a day page and a chapter page are two views over the same notes); B is the one that changes least.

## 2. Reading plans, from the start (notes `fbf6`, `6d32`, `c440`, `9ded`, `032f`)

Three builders, and the plan itself for whichever is chosen. Only a name and what to read are required; no terminal words.

| Design | Windows | In short |
|---|---|---|
| **A. One form, two things required** | [A1 new reading plan](../design/exports/phase2b/a1-new-reading-plan.png), [A2 choose books](../design/exports/phase2b/a2-choose-books.png) | One sheet: name; what to read as chips (quick picks, Choose books… with a grid to tick several, Add a passage…); order, pace (including "my own pace", no dates), start and days off all optional; a summary before starting |
| **B. Start from a preset** | [B1 pick a kind](../design/exports/phase2b/b1-pick-a-kind-of-plan.png), [B2 adjust](../design/exports/phase2b/b2-books-i-choose-adjust.png) | Cards first (Bible in a year, …, Books I choose, At my own pace, A published plan…), then the same few fields filled in, with the first days shown |
| **C. Build it by days** | [C1 the plan as a board](../design/exports/phase2b/c1-the-plan-as-a-board.png) | Books dragged in; days as rows of chapter chips that drag between days; pace as one control that lays them out again, keeping the days moved by hand |
| **The plan itself** | [P1 a plan in its pane](../design/exports/phase2b/p1-a-plan-in-its-pane.png), [P2 days were missed](../design/exports/phase2b/p2-days-were-missed-what-to-do.png) | Today's reading as one card (Read, Mark read); Days with a ✓ and drag to move; when days are missed, four choices that each say what they do to the dates (they replace "Spread the rest…"); ? opens the guide |

A chronological plan (note `032f`) is a published plan imported from its file (B1's last card): which one, from what source,
is still the person's to choose.

## 3. The dock and views (notes `564e`, `2395`, `8c69`)

[D1 dragging a tab](../design/exports/phase2b/d1-dragging-a-tab-where-it-can-go.png) (drop zones: either column, a top
band, a bottom band, split, float) · [D2 the word study view](../design/exports/phase2b/d2-the-word-study-view.png) ·
[D3 the View menu](../design/exports/phase2b/d3-views.png) (saved views; `view word study` in the command field and `wb do`) ·
[D4 where new tabs open](../design/exports/phase2b/d4-where-new-tabs-open.png) (beside the pane they came from).

## 4. Threads, Help, words (notes `73c4`, `9ded`, `0e98`)

[T1 a thread: sort and filter](../design/exports/phase2b/t1-a-thread-sort-and-filter.png) ·
[T2 Help: a guide to the window](../design/exports/phase2b/t2-help-a-guide-to-the-window.png) (Guide, Commands, Keys; each
pane's ? opens its entry) · [T3 a word's English definition](../design/exports/phase2b/t3-a-word-s-english-definition.png)
(the card's text is left blank: it would be verbatim from the dictionary the person chooses, with its source and license).

## 5. The Shelf and settings (notes `3fa7`, `a484`, `c551`, `8810`)

[S1 the Shelf as folders](../design/exports/phase2b/s1-the-shelf-as-folders.png) (a set opens all its tabs) ·
[S2 Settings: Customize](../design/exports/phase2b/s2-settings-customize-the-toolbar.png) (each toolbar button shown or
hidden and in order, with a preview).

## 6. The person's choices (2026-11-04)

1. **The Notebook: B**, the list and the editor, as the main way. Wanted from A and C as options, extra features or ways
   to sort: notes assigned to chapters and books, notes that refer to other notes, documents or parts of them (as
   Obsidian links do), and a document for each day ("today's dump").
2. **Reading plans: A** (one form), with **C** as the deeper builder for custom plans. B only as an optional preset menu
   inside A that fills its boxes, all changeable after. **P** (the plan itself) as drawn.
3. **The dock and views:** the direction is right; views should be as customizable as the toolbar and the plans (perhaps
   in Settings). Floating panes each on their own, not all lumped together.
4. **T1, T2, T3:** good as drawn.
5. **The Shelf (S1):** good, plus closing a tab or a whole set, and adding a tab, document, note and so on from the
   Shelf. **Settings (S2):** good; any pane that can be opened should be able to go on the toolbar (Help, the Guide, any
   command that opens a pane, a "remember" sheet of most used commands, commands the person sets).

The second pass (section 7) draws these.

## 7. Second pass

On the same board, above the first pass: [the board](../design/exports/phase2b/all-designs.png).

| Part | Windows | What it answers |
|---|---|---|
| **Notebook: B, with days and chapters** | [N1 a note with places and links](../design/exports/phase2b/n1-a-note-with-places-and-links.png), [N2 grouped by day: today's page](../design/exports/phase2b/n2-grouped-by-day-today-s-page-a.png), [N3 grouped by chapter, following the reader](../design/exports/phase2b/n3-grouped-by-chapter-following-the-reader-c.png), [N4 Settings → Notebook](../design/exports/phase2b/n4-settings-notebook.png) | B is the Notebook. A note's place can be a verse, a chapter or a book; `[[links]]` to notes and to headings in them, with Linked from (as Obsidian). The list's Group control brings in A (by day, with today's page: one note per day for the day's dump) and C (by chapter, following the reader). Each can be turned off in Settings |
| **Reading plans: the form, presets, the builder** | [R1 the form with presets](../design/exports/phase2b/r1-the-form-with-presets.png), [R2 the builder from the form](../design/exports/phase2b/r2-the-builder-from-the-form.png) | A is the way to make a plan; B's presets are a Start from row that fills its boxes; Arrange the days myself… opens C with what the form holds, and Back to the form keeps it. P as drawn |
| **Views and floating panes** | [V1 Settings → Views](../design/exports/phase2b/v1-settings-views.png), [V2 floating panes, each on its own](../design/exports/phase2b/v2-floating-panes-each-on-its-own.png) | Views designed in Settings: a map of the window to drag panes into, a name, a key, shown in the menu or not, its own toolbar or not. Each floating pane is its own window; two join only when one's tab is dropped on the other's strip |
| **The Shelf and the toolbar** | [SH1 a set: close, add, open](../design/exports/phase2b/sh1-a-set-close-add-open.png), [SH2 a set's tabs kept together](../design/exports/phase2b/sh2-a-set-s-tabs-kept-together.png), [TB1 Customize: add anything](../design/exports/phase2b/tb1-settings-customize-add-anything.png), [TB2 My commands](../design/exports/phase2b/tb2-my-commands.png) | Take an item out of a set, close a set's tabs together, + Add (this tab, all tabs, a new note, a note, place, thread, lesson or document). Any pane, view or command line can be a toolbar button; My commands keeps the commands you set and shows the ones used most, counted from the log |

What the second pass would add to the files, for the person to know before it is built: today's page as one note per
day (`notes/_days/<day>.md`, new); a place that is a whole book (today an anchor is a verse, words or a run of verses: a
book would be the run of all its verses, so the Python app can still read it); links as plain `[[title]]` text in a
note. Views, toolbar buttons and My commands are settings (`settings/*.json`, per key).

## 8. Accepted (2026-11-04)

The person accepted the second pass as drawn, and decided: **Erase now** for notes in the Trash; the published plans and
dictionaries to consider (in [PLAN-phase2b-build.md](PLAN-phase2b-build.md), tiers 3 and 7). The order to build in is
[PLAN-phase2b-build.md](PLAN-phase2b-build.md).
