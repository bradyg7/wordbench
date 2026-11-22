# Filters, the new design

**State:** exploring (round 2, 2026-11-22) · **Sheets:** `python -B design/features/filters-v2/filters2.py` writes `rows/<id>.png` and `rows/index.json`, one frame per row ·
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

- **2026-11-22, the lead (round 2).** The four ways read **is**, **is not**, **is not set**, **is set** (round 1 said
  "is empty", "is not empty"); the file writes the same words: `filter: Status is not set`, `filter: Status is set`.
- **2026-11-22, the lead (round 2).** Chips look like buttons everywhere (the person: round 1's chips did not look
  clickable): a border, a fill, ▾ to open the picker and a separate ×; **Add filter** is a labelled button, never a bare
  +. On desktop, many chips wrap onto a second line (no squish, no sideways scroll); on a phone a chip takes its own
  line when it needs it, taps are at least 44 px, and pickers are a bottom sheet with Done.
- **2026-11-22, the lead (round 2).** Custom page properties (NB14's + Property, kept on the page's `props:` line)
  are filterable like any other and listed under "Your own properties" in the Filter menu.

## Interaction table

### A list in a page

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 1 | A list's head | Filter (1a: where it is; 1b: the menu) | 1a: every list in a page has a head with a labelled **Filter** button. 1b: a searchable menu (the one menu), each choice with a short line saying what it is: About the page (Folder when the list spans folders, Edited, Written, Callout kind, Book), then Your own properties (columns added with + Property) | Nothing | Window only | `filter_menu_lists_properties` | [ ] |
| 2 | Filter menu | Pick a property, tick a value (2a); what the four ways mean (2b) | Its values as a checklist with counts; ticking applies at once, the list narrows behind, a chip "Status: Open" appears; the head says "3 of 6 pages". The four ways read **is**, **is not**, **is not set**, **is set** (2b explains each with an example) | One `filter:` line in the list's `view` fence | `wb block view ID N --filter "Status is Open"` | `tick_value_applies_at_once` | [ ] |
| 3 | A chip | Click it (or Enter on it) | The same picker under the chip, with is, is not, is not set, is set | That `filter:` line | `wb block view ID N --filter …` | `chip_reopens_its_picker` | [ ] |
| 4 | A chip | × (or Backspace on a focused chip) (4a); many chips (4b) | That filter goes; the list widens; focus moves to the next chip or to Filter. Many chips wrap onto a second line at the full width; nothing is squeezed or scrolled; Add filter and Clear all stay at the end | Its line removed | `wb block view ID N --unfilter PROPERTY` | `chip_x_removes_filter` | [ ] |
| 5 | Chip row | Clear | Every filter goes; the list shows all its pages; search words stay | Every `filter:` line removed | `wb block view ID N --unfilter all` | `clear_removes_all_filters` | [ ] approved 2026-11-22 |
| 6 | Chip row | Add a second filter | A page must match every chip; a chip with several values matches any of them | A second line | `--filter` twice | `filters_combine_and_within_or` | [ ] approved 2026-11-22 |
| 7 | Filter menu | Edited or Written | Fixed choices: Today, Last 7 days, Last 30 days, Last year, Any time; no typed dates | `filter: Edited last 7 days` | `wb block view ID N --filter "Edited last 7 days"` | `date_filter_fixed_choices` | [ ] approved 2026-11-22 |
| 8 | A list's head | Search this list (the magnifier), type words | The words narrow the list with the chips; Esc empties the field | Nothing (the words are not kept) | Window only | `search_this_list_with_chips` | [ ] approved 2026-11-22 |
| 9 | Any view | Filter on Table, List, Gallery or Board, grouped or not | The same chips on every view; group counts follow the filters; a Board column left empty stays with 0 so a card can be dragged into it | The fence's lines | as rows 2–7 | `chips_on_every_view` | [ ] approved 2026-11-22 |
| 10 | A filtered list | Nothing matches | "No pages match these filters." and Clear filters, in the list's own place; the chips stay | Nothing | Window only | `no_match_says_so` | [ ] approved 2026-11-22 |
| 11 | A page | Close it, open it again (11a before, 11b after) | The same chips are on its list, showing the same pages; nothing asks to save | Nothing | `wb page views ID` gives `filters` | `filters_kept_in_the_page` | [ ] |
| 12 | A chip | Its value is gone (folder deleted, property removed) | The chip shows the value struck through and "gone"; the list ignores that filter; × removes it | Nothing until × | `wb page views ID` marks it `gone` | `gone_value_chip` | [ ] approved 2026-11-22 |

### The Library's lists

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 13 | Questions list (side list) | Open it (13a: Questions at the side list's foot), then Add filter beside All, Question, Answered (13b) | A Folder or Book chip from the same picker; the list narrows | Nothing (window, for the tab) | `wb question list --kind … --folder NAME --book BOOK` | `questions_list_chips` | [ ] |
| 14 | Ctrl+K | + Filter under the search field | Kind (Pages, Questions, Key points, Notes, Folders) and Folder chips narrow the one search; Esc clears the words first, then closes | Nothing | `wb find WORDS --kind K --folder NAME` (existing flags) | `ctrlk_chips_narrow_search` | [ ] approved 2026-11-22 |
| 15 | An opened folder | Add filter, in a folder of about a hundred saves | The folder grouped by kind of save with counts, scrolling; Save and Book chips show 18 of 120 | Nothing | `wb folder show NAME --kind K --book BOOK` | `folder_chips` | [ ] |

### What each filter means (round 2)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 17 | Filter menu | Folder | Plain words beside the menu: the folder a page is in; Folder: Phinehas shows the 3 pages in Phinehas | `filter: Folder is Phinehas` | `--filter "Folder is Phinehas"` | `filter_by_folder` | [ ] |
| 18 | Filter menu | Status | A column you add yourself with + Property; it means only what you make it mean, the app never sets it; a question's Question or Answered is Callout kind, not Status | `filter: Status is Open` | `--filter "Status is Open"` | `filter_by_own_status` | [ ] |
| 19 | Filter menu | Edited and Written | Edited: when the page was last changed; Written: when it was first made; fixed choices only | `filter: Edited last 7 days` | `--filter "Edited last 7 days"` | `filter_by_edited_written` | [ ] |
| 20 | Filter menu | Book (and Chapter inside it) | The books a page names in its references and Scripture blocks; a page naming two books is under both; Chapter is picked inside Book (Numbers › 25) | `filter: Book is Numbers` or `Book is Numbers 25` | `--filter "Book is Numbers"` | `filter_by_book` | [ ] |
| 21 | Filter menu | Callout kind | The callouts written in a page: Question, Answered, Key point, Note | `filter: Callout kind is Question` | `--filter "Callout kind is Question"` | `filter_by_callout_kind` | [ ] |
| 22 | Filter menu | Your own properties | Any column added with + Property (here Speaker) is offered with the values the pages hold | `filter: Speaker is J. Moore` | `--filter "Speaker is J. Moore"` | `filter_by_own_property` | [ ] |

### Where a list comes from (round 2)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 23 | Any page | / › List in a page (23a), then pick a folder (23b) | Any page can hold a list; "All study pages" in these frames is such a list in a page of that name; its head carries the view, Search and Filter | The `view` fence | `wb block add ID --as view "notebook thread ID"` (NB14) | `list_placed_from_slash` | [ ] |

### Real conditions

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 16 | Phone, narrow pane, floating tab | Filter, or a chip (16a the list, 16b the sheet) | A labelled **Filter · 3** button; chips are big bordered buttons (▾ and a separate ×, 44 px to tap) that wrap onto as many lines as needed, nothing off screen; tapping opens a bottom sheet with big rows, the four ways as buttons, Remove this filter and Done | As rows 2–7 | as rows 2–7 | `chips_on_phone` | [ ] |

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
| 1 | 2026-11-22 | rows/ (16 frames) | Chips on a list in a page, the Library's lists, phone | Reviewed 2026-11-22 (Directions) |
| 2 | 2026-11-22 | rows/ (30 frames) | Step frames, what each filter means, the four ways in plain words, button-like chips, wrapping, a hundred saves, phone redrawn | |

## Directions

### Round 1 review (the person, 2026-11-22; review-filters-v2-round1.json)

Tally: 8 Perfect, 7 Satisfactory, 1 unrated with a comment. Worst first.

| Row | Rating | Asked | Round 2 |
|---|---|---|---|
| 16 | Satisfactory | Not intuitive; top chips go off screen; chips don't look clickable; must suit non-technical users on a phone, across the app | Redrawn (16a, 16b): chips are bordered buttons with ▾ and ×, a labelled Filter · 3 button, chips wrap so nothing leaves the screen, 44 px taps, a bottom sheet with big rows and Done. The same button look on desktop. |
| 11 | Satisfactory | Unclear label, frame unclear, needs before and after | Two frames: 11a Monday, filters added, then closed; 11b Tuesday, opened again with the same chips; plain captions. |
| 1 | Satisfactory | What do Edited, Status, Written mean; how do I get here; are custom properties a thing? | 1a shows the Filter button to click; 1b gives each choice a line saying what it is. New rows 17–22, one per filter, explain it in plain words with an example. Custom properties are in (row 22). |
| 2 | Satisfactory | What do is, is not, is empty, is not empty mean; is "All study pages" a view, and where are lists found? | 2b explains the four ways with examples; plainer words recommended: is, is not, is not set, is set. New row 23: a list is placed in any page with / › List in a page. |
| 4 | Satisfactory | Many chips at screen width: wrap or squish? | 4b: they wrap onto a second line (recommended over squish or scroll). |
| 13 | Satisfactory | How do I get to the Questions list? | 13a: Questions at the foot of the side list; 13b the list. |
| 3 | Satisfactory | (no comment) | Redrawn with the new chip look and the new words. |
| 15 | (unrated) | See it with about a hundred saves of real-looking data | Redrawn: a folder of 120 saves grouped by kind with counts, scrolling; references and Strong's numbers only, no scripture drawn. |

### Approved (round 1)

Rows 5, 6, 7, 8, 9, 10, 12, 14 (Perfect, no change asked).
