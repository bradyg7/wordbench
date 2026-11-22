# Filters, round 1 of the new design

**State:** exploring (round 1, 2026-11-22) · **Sheets:** `python -B design/features/filters-v2/filters2.py` writes `rows/<id>.png` and `rows/index.json`, one frame per row ·
Nothing here is built. · **Review page:** `node design/review.mjs filters-v2` writes `review.html`.

The person, 2026-11-22: "I'd rather scrap the old one, and use one that fits the newer design better." The old
[filters](../filters/README.md) design (Direction B: a Filters panel with Apply, a bottom sheet, one labeled row per
applied value) is superseded and kept as history. This folder starts again from what the Notebook now is: a list in a
page with views (Table, List, Gallery, Board), Group by and page properties (Notebook rows 36, 47, 48; built in NB14),
Ctrl+K and the side list (NB13), all drawn with the one menu component (Notebook row 1).

## Leading design

Filters are **chips**, as in Notion. On a list in a page, **Filter** opens a searchable menu of what the list can be
narrowed by: its folders, callout kind, when pages were edited or written, and every page property its pages hold.
Picking one opens a checklist of that property's values with counts; ticking a value applies at once, the list narrows
behind the menu, and a chip **Status: Open** appears under the list's head. A chip's ▾ reopens its picker (with *is*,
*is not*, *is empty*, *is not empty*); its × takes it away; **Clear** takes them all. Every chip must match. The head
counts what is shown ("3 of 6 pages"). The only typed field is **Search this list**; everything else is picked. The
chips are kept in the page: the list's `view` fence gets one `filter:` line each. The same chips appear on the
Library's lists: the Questions list (beside All, Question, Answered), Ctrl+K (under its search field) and an opened
folder.

## How this fits what is already accepted

- **Notebook (accepted 2026-11-20, built NB1–NB14).** The `view` fence, its option lines and page `props:` are NB14's
  (Notebook Decisions, "List in a page, Table, views and Group by"). A filter is one more option line. The pickers are
  the one menu (row 1). NB14's interim Filters button (it opens the list's line for editing) is replaced by row 1 here.
- **No typed filters** (the person, 2026-11-20): kept. Dates are fixed choices; values are picked from what the pages
  hold.
- **Questions list chips** (NB13, row 46b): All, Question and Answered stay as built; this design adds + Filter beside
  them.
- **Library map Open 6** ("Filters, everywhere"): this folder is now its design. Its other surfaces (the Legend's
  "where used", Colors across the Bible, Bible Search, Every use and Concordance, Findings) are not in round 1; see
  Open questions.

## Decisions

- **2026-11-22, the person.** Scrap the old Filters design (Direction B) and design filters again to fit the Notebook.
- **2026-11-22, the lead (file form, by the person's standing go-ahead of 2026-11-21).** A filter is kept in the list's
  ```` ```view ```` fence as one line each, under the command line and the other options:
  `filter: PROPERTY is VALUE[, VALUE…]`, `filter: PROPERTY is not VALUE[, …]`, `filter: PROPERTY is empty`,
  `filter: PROPERTY is not empty`, and for dates `filter: Edited|Written today|last 7 days|last 30 days|last year`.
  Several values on one line match any of them; several lines must all match. Plain words, one line each, so the file
  reads like the chips and other Markdown tools show it as text; it extends NB14's `name: value` option lines rather
  than adding a second form. A line that names a property or value no longer present is kept as written (row 12).
- **2026-11-22, the lead.** Chips apply at once; there is no Apply button and no pending state (the old design's
  Apply, Close and pending edits are dropped). Undo of a filter change is the chip's ×.
- **2026-11-22, the lead.** Folder is offered only when the list's pages come from more than one folder; a list that
  names one folder already is that folder.
- **2026-11-22, the lead.** The Library lists' chips (rows 13–15) live only in the window for the life of the tab (as
  the side list's choices do today); only a list in a page keeps its filters on disk.

## Interaction table

### A list in a page

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 1 | A list's head | Filter | A searchable menu (the one menu): Folder (when the list spans folders), Callout kind, Edited, Written, then every page property its pages hold | Nothing | Window only | `filter_menu_lists_properties` | [ ] |
| 2 | Filter menu | Pick a property, tick a value | Its values as a checklist with counts; ticking applies at once, the list narrows behind, a chip "Status: Open" appears; the head says "3 of 6 pages" | One `filter:` line in the list's `view` fence | `wb block view ID N --filter "Status is Open"` | `tick_value_applies_at_once` | [ ] |
| 3 | A chip | Click it (or Enter on it) | The same picker under the chip, with is, is not, is empty, is not empty | That `filter:` line | `wb block view ID N --filter …` | `chip_reopens_its_picker` | [ ] |
| 4 | A chip | × (or Backspace on a focused chip) | That filter goes; the list widens; focus moves to the next chip or to Filter | Its line removed | `wb block view ID N --unfilter PROPERTY` | `chip_x_removes_filter` | [ ] |
| 5 | Chip row | Clear | Every filter goes; the list shows all its pages; search words stay | Every `filter:` line removed | `wb block view ID N --unfilter all` | `clear_removes_all_filters` | [ ] |
| 6 | Chip row | Add a second filter | A page must match every chip; a chip with several values matches any of them | A second line | `--filter` twice | `filters_combine_and_within_or` | [ ] |
| 7 | Filter menu | Edited or Written | Fixed choices: Today, Last 7 days, Last 30 days, Last year, Any time; no typed dates | `filter: Edited last 7 days` | `wb block view ID N --filter "Edited last 7 days"` | `date_filter_fixed_choices` | [ ] |
| 8 | A list's head | Search this list (the magnifier), type words | The words narrow the list with the chips; Esc empties the field | Nothing (the words are not kept) | Window only | `search_this_list_with_chips` | [ ] |
| 9 | Any view | Filter on Table, List, Gallery or Board, grouped or not | The same chips on every view; group counts follow the filters; a Board column left empty stays with 0 so a card can be dragged into it | The fence's lines | as rows 2–7 | `chips_on_every_view` | [ ] |
| 10 | A filtered list | Nothing matches | "No pages match these filters." and Clear filters, in the list's own place; the chips stay | Nothing | Window only | `no_match_says_so` | [ ] |
| 11 | A page | Open it again | The chips are as they were, read from the fence's `filter:` lines | Nothing | `wb page views ID` gives `filters` | `filters_kept_in_the_page` | [ ] |
| 12 | A chip | Its value is gone (folder deleted, property removed) | The chip shows the value struck through and "gone"; the list ignores that filter; × removes it | Nothing until × | `wb page views ID` marks it `gone` | `gone_value_chip` | [ ] |

### The Library's lists

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 13 | Questions list (side list) | + Filter beside All, Question, Answered | A Folder or Book chip from the same picker; the list narrows | Nothing (window, for the tab) | `wb question list --kind … --folder NAME --book BOOK` | `questions_list_chips` | [ ] |
| 14 | Ctrl+K | + Filter under the search field | Kind (Pages, Questions, Key points, Notes, Folders) and Folder chips narrow the one search; Esc clears the words first, then closes | Nothing | `wb find WORDS --kind K --folder NAME` (existing flags) | `ctrlk_chips_narrow_search` | [ ] |
| 15 | An opened folder | + Filter | Kind of save (verse, word, page, search) and Book chips over the folder's own order | Nothing | `wb folder show NAME --kind K --book BOOK` | `folder_chips` | [ ] |

### Real conditions

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 16 | Phone, narrow pane, floating tab | Filter, or a chip | The chips stay on one line and scroll sideways; Filter and a chip's picker open as a bottom sheet with the same checklist | As rows 2–7 | as rows 2–7 | `chips_on_phone` | [ ] |

## What the build must satisfy

- [ ] Every picker is the one menu component (Notebook row 1); a phone gets it as a bottom sheet (row 16).
- [ ] No typed filter values anywhere in the window; Search this list is the only typed field (rows 7, 8).
- [ ] A filter applies the moment it is picked; nothing waits on an Apply.
- [ ] The `view` fence's `filter:` lines read and write as the Decisions say; a page whose fence has none behaves as
      today, and NB14's other option lines are untouched (rows 2, 11).
- [ ] NB14's interim Filters button (opening the line for editing) is taken out, not kept beside the chips.
- [ ] Every new core action has its `wb` command.

## Data the sheets show

Page titles, folders (Phinehas, Salt, Anna), their colors and the Status and Book properties are a drawn sample, never
anyone's study. The two questions in row 13 are samples. No scripture is drawn.

## Open questions

1. **The other surfaces of Library Open 6.** The Legend's "where used", Colors across the Bible, Bible Search and Near,
   Every use and Concordance, Findings and the reader's Highlights list each narrow a list today. Should each take the
   same chips in a later round (lead's leaning: yes, one round each, in the map's priority order), or stay as built?
2. **The Marks filter (marks T12)**, which the person "really doesn't like": retire it into Ctrl+K's chips (a Kind:
   Marks chip with a Legend entry chip), or design marks finding on its own?
3. **Any of / all of.** Round 1 has every chip must match, values within a chip any. Is a whole "match any chip"
   switch wanted (Notion's filter groups), or is that more than a study needs?
4. **Library map words.** This folder uses two words the map does not list yet: **filter** (a picked condition shown as
   a chip on a list) and **page property** (a column kept in a page's front matter, from NB14). Proposed map change:
   add both to the words table. The old word "applied value" is retired with Direction B.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-22 | rows/ (16 frames) | Chips on a list in a page, the Library's lists, phone | |

## Directions
