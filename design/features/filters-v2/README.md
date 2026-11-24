# Filters, the new design

> **Read [the principles](../principles/README.md) first** (2026-11-22): it says which of this folder's decisions stand under the new frame (desks, bubbles, the dock) and lists any that conflict, for the person to settle.

**State:** up for redesign (the person, 2026-11-24); was: accepted (the person, 2026-11-22, after round 3) · **Sheets:** `python -B design/features/filters-v2/filters2.py` writes `rows/<id>.png` and `rows/index.json`, one frame per row ·
NB16 (rows 1-25) and NB17 (rows 26-33) are built. · **Review page:** `node design/review.mjs filters-v2` writes `review.html`.

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

### NB16, file and `wb` forms chosen by the builder (2026-11-22, by the most compatible form)

- **`filter:` and `type:` lines.** In the `view` fence after `view/group/columns/sort`, `type:` lines first, then `filter:` lines. One filter per property:
  a second `--filter` for a property replaces the first. Values in one line split at commas; a comma inside a value is written `\,`
  (`filter: Speaker is Moore\, J.`). A line that does not read is kept as it was written and ignored. `Edited any time` takes the filter away.
- **Gone.** A Folder value is gone when no such folder exists; an own property is gone when no page holds it and no column or `type:` names it.
  A gone filter is ignored and shown struck through with "gone"; a value that is only not held now (no page has Open) is not gone: it matches nothing.
- **`wb` forms.** `wb block view ID N --filter "…" --unfilter PROPERTY|all --type "Name text|choice|date|yesno"` (repeatable); `wb page views ID --filter "…"`
  lays filters over one answer and writes nothing; `wb page prop ID NAME VALUE --type date|yesno|choice|text` checks a value (Date `YYYY-MM-DD`, Yes/no kept as
  `true` or `false`). `wb question list`, `wb find` and `wb folder show` take `--filter` (and `--folder`/`--book`, `--kind`/`--book`); `wb find --filter` accepts
  Kind, Folder and Edited with `is`; `wb folder show` Save (Verse, Word, Page) and Book; `wb question list` Kind, Folder, Book, Edited, Written.
  A list refuses a property it does not have with the properties it has. `wb find --folder` now also reads a thread folder (a folder with a color).
- **Window.** The head's button is `Filter` (`Filter · N` with chips); the chip row has `Add filter` (`Filter · N` on a phone) and `Clear`. Search this list is the
  magnifier in the head. The Library lists keep their chips for the tab only (`question list --filter`, `find --filter` in Ctrl+K, the folder's places narrowed in the window).
  Ctrl+K: Esc clears the words first, then closes. `x-wb-argv` is sent with every fixture request outside the app so tests read the exact words.

### NB17, file and `wb` forms chosen by the builder (2026-11-22, by the most compatible form)

- **The real commands.** The README's names for rows 26-33 were guesses; the lists' own commands take `--filter "…"` (repeatable, the words of NB16):
  Margin notes `wb find --kind margin`, Highlights and Marks `wb find --kind highlight|mark` (`--kind mark` finds the drawn marks, old highlights
  included), Findings `wb findings`, the Legend's where used `wb legend uses ENTRY`, Colors across the Bible `wb marks map`, Bible Search `wb search`,
  Near `wb near`, Every use `wb uses`, the Concordance `wb concordance`. Each answer carries `properties` (the Filter menu: each property with
  its values and counts), `filters` (the ones applied) and `unfiltered` (how many rows there were); a list refuses a property it does not have and
  names the ones it has (`No property called “Status” here; this list has Book, Testament, Version.`). Nothing is written to the study folder.
- **What each list offers.** Margin notes: Book (the chapter inside it, `Book is Numbers 25`), Written, Edited, Folder (the folders of the pages a
  note grew into). Highlights and Marks: Kind (Highlight, Underline, Circle, Box, Arrow), Legend entry, Book, Written. Findings: Status (Open,
  Handled; a Status chip lists the handled ones too), Kind (the design folders a finding is tagged with), Written. Where used: Book, Kind. Colors:
  Legend entry (several values add their counts), Book. Search and Near: Book, Testament (Old Testament, New Testament), Version (the KJV is the only
  version searched; `Version is YLT` finds nothing). Every use: Book, Testament, Strong's number (the original words behind an English word, by
  number). Concordance: Book, Testament.
- **Kind and Marks in the one search.** `wb find --filter "Kind is Marks"` still sets the list (Pages, Questions, Key points, Notes, Folders, Saves,
  Margin notes, Highlights, Marks). Once the list is Margin notes, Highlights or Marks, `Kind is Underline` is the mark's own kind. The T12 controls of
  the Marks search (kind, legend entry, book, since, until) are retired into this Kind chip, a Legend entry chip, Book and Written; `--style`,
  `--mark-kind`, `--color`, `--book`, `--since` and `--until` stay on `wb find` for a terminal. The Legend's typed "Filter by book" and the Findings'
  tag pills are retired into the chips too (no typed filter value anywhere).
- **Window.** Each list keeps its chips for the life of the window only (`listChips` in `ui/src/chips.ts`); a Search, Near or Every use pane keeps them per
  pane. On Colors across the Bible the style and folder chips stay beside the new row; a Legend entry chip takes the place of the style chip.
- **Not changed.** Every use's "both / only the original / only the English" chips are the lookup's own categories and stay as they are.

### Round 3 (2026-11-22, the person through the lead's recommendations)

- **One chip component, everywhere a list is narrowed.** The filter chips are one part and work the same way on every
  list: a list in a page, the Library's lists (Questions, an opened folder, Ctrl+K), and the Margin notes list,
  Highlights, Findings, the Legend's "where used", Colors across the Bible, Bible Search and Near, Every use and the
  Concordance (rows 26–33). Each list offers only the properties it has. Answers open question 1 and row 13.
- **The Marks filter (marks T12) folds into the chips:** a Kind: Marks chip plus a Legend entry chip. Its own filter is
  retired. Answers open question 2.
- **No "match any chip" switch.** Every chip must match; the values inside one chip match any of them. Answers open
  question 3.
- **Making your own property (row 22).** In a list in a page, **+ Property** at the right of the table head: type a
  name, pick a type (Text, Choice, Date, Yes/no), then fill the cells (row 24). On any page, page ⋯ › **Properties**
  shows and edits the same values (row 25). Values stay in the page's `props:` line (NB14). NB14 built text
  properties only; the four types are new in this design. File forms: Text is a string, Choice is one of the values
  the list has seen (kept as a string), Date is `YYYY-MM-DD`, Yes/no is `true`/`false`. The type of a property is
  kept on the list's `view` fence as `type: Speaker text` (one line per typed property), so one page's values never
  decide another's type.
- **One `wb` filter form.** Every list command takes `--filter "Status is Open"`, repeatable, in the same words as
  the file's `filter:` line. Commands that cannot take a property name refuse it with the list of properties they have.
- **Library map.** The words **filter** and **page property** are added to the map (open question 4).

## Interaction table

### A list in a page

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 1 | A list's head | Filter (1a: where it is; 1b: the menu) | 1a: every list in a page has a head with a labelled **Filter** button. 1b: a searchable menu (the one menu), each choice with a short line saying what it is: About the page (Folder when the list spans folders, Edited, Written, Callout kind, Book), then Your own properties (columns added with + Property) | Nothing | Window only | `filter_menu_lists_properties` | built (NB16) · approved 2026-11-22 |
| 2 | Filter menu | Pick a property, tick a value (2a); what the four ways mean (2b) | Its values as a checklist with counts; ticking applies at once, the list narrows behind, a chip "Status: Open" appears; the head says "3 of 6 pages". The four ways read **is**, **is not**, **is not set**, **is set** (2b explains each with an example) | One `filter:` line in the list's `view` fence | `wb block view ID N --filter "Status is Open"` | `tick_value_applies_at_once` | built (NB16) · approved 2026-11-22 |
| 3 | A chip | Click it (or Enter on it) | The same picker under the chip, with is, is not, is not set, is set | That `filter:` line | `wb block view ID N --filter …` | `chip_reopens_its_picker` | built (NB16) · approved 2026-11-22 |
| 4 | A chip | × (or Backspace on a focused chip) (4a); many chips (4b) | That filter goes; the list widens; focus moves to the next chip or to Filter. Many chips wrap onto a second line at the full width; nothing is squeezed or scrolled; Add filter and Clear all stay at the end | Its line removed | `wb block view ID N --unfilter PROPERTY` | `chip_x_removes_filter` | built (NB16) · approved 2026-11-22 |
| 5 | Chip row | Clear | Every filter goes; the list shows all its pages; search words stay | Every `filter:` line removed | `wb block view ID N --unfilter all` | `clear_removes_all_filters` | built (NB16) · approved 2026-11-22 |
| 6 | Chip row | Add a second filter | A page must match every chip; a chip with several values matches any of them | A second line | `--filter` twice | `filters_combine_and_within_or` | built (NB16) · approved 2026-11-22 |
| 7 | Filter menu | Edited or Written | Fixed choices: Today, Last 7 days, Last 30 days, Last year, Any time; no typed dates | `filter: Edited last 7 days` | `wb block view ID N --filter "Edited last 7 days"` | `date_filter_fixed_choices` | built (NB16) · approved 2026-11-22 |
| 8 | A list's head | Search this list (the magnifier), type words | The words narrow the list with the chips; Esc empties the field | Nothing (the words are not kept) | Window only | `search_this_list_with_chips` | built (NB16) · approved 2026-11-22 |
| 9 | Any view | Filter on Table, List, Gallery or Board, grouped or not | The same chips on every view; group counts follow the filters; a Board column left empty stays with 0 so a card can be dragged into it | The fence's lines | as rows 2–7 | `chips_on_every_view` | built (NB16) · approved 2026-11-22 |
| 10 | A filtered list | Nothing matches | "No pages match these filters." and Clear filters, in the list's own place; the chips stay | Nothing | Window only | `no_match_says_so` | built (NB16) · approved 2026-11-22 |
| 11 | A page | Close it, open it again (11a before, 11b after) | The same chips are on its list, showing the same pages; nothing asks to save | Nothing | `wb page views ID` gives `filters` | `filters_kept_in_the_page` | built (NB16) · approved 2026-11-22 |
| 12 | A chip | Its value is gone (folder deleted, property removed) | The chip shows the value struck through and "gone"; the list ignores that filter; × removes it | Nothing until × | `wb page views ID` marks it `gone` | `gone_value_chip` | built (NB16) · approved 2026-11-22 |

### The Library's lists

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 13 | Questions list (side list) | Open it (13a: Questions at the side list's foot), then Add filter beside All, Question, Answered (13b) | A Folder or Book chip from the same picker; the list narrows | Nothing (window, for the tab) | `wb question list --kind … --folder NAME --book BOOK` | `questions_list_chips` | built (NB16) · approved 2026-11-22 |
| 14 | Ctrl+K | + Filter under the search field | Kind (Pages, Questions, Key points, Notes, Folders) and Folder chips narrow the one search; Esc clears the words first, then closes | Nothing | `wb find WORDS --kind K --folder NAME` (existing flags) | `ctrlk_chips_narrow_search` | built (NB16) · approved 2026-11-22 |
| 15 | An opened folder | Add filter, in a folder of about a hundred saves | The folder grouped by kind of save with counts, scrolling; Save and Book chips show 18 of 120 | Nothing | `wb folder show NAME --kind K --book BOOK` | `folder_chips` | built (NB16) · approved 2026-11-22 |

### What each filter means (round 2)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 17 | Filter menu | Folder | Plain words beside the menu: the folder a page is in; Folder: Phinehas shows the 3 pages in Phinehas | `filter: Folder is Phinehas` | `--filter "Folder is Phinehas"` | `filter_by_folder` | built (NB16) · approved 2026-11-22 |
| 18 | Filter menu | Status | A column you add yourself with + Property; it means only what you make it mean, the app never sets it; a question's Question or Answered is Callout kind, not Status | `filter: Status is Open` | `--filter "Status is Open"` | `filter_by_own_status` | built (NB16) · approved 2026-11-22 |
| 19 | Filter menu | Edited and Written | Edited: when the page was last changed; Written: when it was first made; fixed choices only | `filter: Edited last 7 days` | `--filter "Edited last 7 days"` | `filter_by_edited_written` | built (NB16) · approved 2026-11-22 |
| 20 | Filter menu | Book (and Chapter inside it) | The books a page names in its references and Scripture blocks; a page naming two books is under both; Chapter is picked inside Book (Numbers › 25) | `filter: Book is Numbers` or `Book is Numbers 25` | `--filter "Book is Numbers"` | `filter_by_book` | built (NB16) · approved 2026-11-22 |
| 21 | Filter menu | Callout kind | The callouts written in a page: Question, Answered, Key point, Note | `filter: Callout kind is Question` | `--filter "Callout kind is Question"` | `filter_by_callout_kind` | built (NB16) · approved 2026-11-22 |
| 22 | Filter menu | Your own properties | Any column added with + Property (here Speaker) is offered with the values the pages hold | `filter: Speaker is J. Moore` | `--filter "Speaker is J. Moore"` | `filter_by_own_property` | built (NB16) · approved 2026-11-22 |

### Where a list comes from (round 2)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 23 | Any page | / › List in a page (23a), then pick a folder (23b) | Any page can hold a list; "All study pages" in these frames is such a list in a page of that name; its head carries the view, Search and Filter | The `view` fence | `wb block add ID --as view "notebook thread ID"` (NB14) | `list_placed_from_slash` | built (NB16) · approved 2026-11-22 |

| 24 | A list in a page, table head | + Property, type a name, pick Text, Choice, Date or Yes/no | A new column with that name; its cells take that type (a Choice cell offers the values already used, a Date cell a date picker, Yes/no a tick); the Filter menu offers it under Your own properties | Each page's `props:` line as cells are filled; `type:` on the list's `view` fence | `wb page prop ID NAME VALUE`; `wb block view ID N --type "NAME text|choice|date|yesno"`, *proposed* | `own_property_add_and_type` | built (NB16) · approved 2026-11-22 |
| 25 | Page ⋯ | Properties | The page's properties as name and value lines, editable; + Add property | The page's `props:` line | `wb page prop ID [NAME [VALUE]] [--remove]` (NB14) | `page_menu_properties` | built (NB16) · approved 2026-11-22 |
### Every other list (round 3, text only)

One row per list that narrows today; each takes the one chip component. No frames: they look and act as rows 1–16.

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 26 | Margin notes list | Add filter | The same chips and pickers as a list in a page, offering only: Book, Chapter, Written, Edited, Folder; Marks are a Kind chip with a Legend entry chip | Window state only (kept for the tab) | `wb find --kind margin --filter "…"` (repeatable; the Notebook search's Margin notes list. `wb mark notes` is one chapter's notes and takes no filter) | `margin_notes_chips` | built (NB17) · approved 2026-11-22 |
| 27 | Highlights list | Add filter | The same chips and pickers as a list in a page, offering only: Kind, Legend entry, Book, Chapter, Written; Marks are a Kind chip with a Legend entry chip | Window state only (kept for the tab) | `wb find --kind highlight --filter "…"` and `wb find --kind mark --filter "…"` (repeatable; the Highlights and Marks lists; `wb marks` is one chapter and takes none) | `highlights_chips` | built (NB17) · approved 2026-11-22 |
| 28 | Findings | Add filter | The same chips and pickers as a list in a page, offering only: Status, Kind, Written; Marks are a Kind chip with a Legend entry chip | Window state only (kept for the tab) | `wb findings --filter "…"` (repeatable) | `findings_chips` | built (NB17) · approved 2026-11-22 |
| 29 | The Legend's "where used" | Add filter | The same chips and pickers as a list in a page, offering only: Book, Chapter, Kind; Marks are a Kind chip with a Legend entry chip | Window state only (kept for the tab) | `wb legend uses ENTRY --filter "…"` (repeatable) | `legend_where_used_chips` | built (NB17) · approved 2026-11-22 |
| 30 | Colors across the Bible | Add filter | The same chips and pickers as a list in a page, offering only: Legend entry, Book; Marks are a Kind chip with a Legend entry chip | Window state only (kept for the tab) | `wb marks map --filter "…"` (repeatable) | `colors_chips` | built (NB17) · approved 2026-11-22 |
| 31 | Bible Search and Near | Add filter | The same chips and pickers as a list in a page, offering only: Book, Testament, Version; Marks are a Kind chip with a Legend entry chip | Window state only (kept for the tab) | `wb search WORDS --filter "…"` and `wb near A B --filter "…"` (repeatable) | `bible_search_chips` | built (NB17) · approved 2026-11-22 |
| 32 | Every use | Add filter | The same chips and pickers as a list in a page, offering only: Book, Testament, Strong's number; Marks are a Kind chip with a Legend entry chip | Window state only (kept for the tab) | `wb uses TERM --filter "…"` (repeatable) | `every_use_chips` | built (NB17) · approved 2026-11-22 |
| 33 | Concordance | Add filter | The same chips and pickers as a list in a page, offering only: Book, Testament; Marks are a Kind chip with a Legend entry chip | Window state only (kept for the tab) | `wb concordance WORD --filter "…"` (repeatable) | `concordance_chips` | built (NB17) · approved 2026-11-22 |

### Real conditions

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 16 | Phone, narrow pane, floating tab | Filter, or a chip (16a the list, 16b the sheet) | A labelled **Filter · 3** button; chips are big bordered buttons (▾ and a separate ×, 44 px to tap) that wrap onto as many lines as needed, nothing off screen; tapping opens a bottom sheet with big rows, the four ways as buttons, Remove this filter and Done | As rows 2–7 | as rows 2–7 | `chips_on_phone` | built (NB16) · approved 2026-11-22 |

## Tickets (cut 2026-11-22, built in this order, one at a time)

| Ticket | Rows | What |
|---|---|---|
| NB16 | 1–25 | The one chip component and the Filter menu on a list in a page (every view), the Library's lists (Questions, an opened folder, Ctrl+K), typed page properties and page ⋯ › Properties, phone and narrow; `--filter` on `wb page views`, `wb question list`, `wb find`; replaces NB14's interim Filters button |
| NB17 (built 2026-11-22) | 26–33 | The same chips on Margin notes, Highlights, Findings, the Legend's "where used", Colors across the Bible, Bible Search and Near, Every use and Concordance; the marks T12 filter retired into them; `--filter` on each list command |

## What the build must satisfy

- [x] Every picker is the one menu component (Notebook row 1); a phone gets it as a bottom sheet (row 16).
- [x] No typed filter values anywhere in the window; Search this list is the only typed field (rows 7, 8).
- [x] A filter applies the moment it is picked; nothing waits on an Apply.
- [x] The `view` fence's `filter:` lines read and write as the Decisions say; a page whose fence has none behaves as
      today, and NB14's other option lines are untouched (rows 2, 11).
- [x] NB14's interim Filters button (opening the line for editing) is taken out, not kept beside the chips.
- [x] Every new core action has its `wb` command.

NB16 evidence (2026-11-22): every row's test is in `ui/tests/notebook-filters.spec.ts` (chromium-editor, webkit-desktop, webkit-phone) and, for the
files and `wb`, `filters_on_a_list_in_a_page`, `own_property_add_and_type` and `filters_on_the_librarys_lists` in `crates/wb-cli/tests/cli.rs`.
The rows' test names are the specs' names (row 23: `list_placed_from_slash`). Rows 26-33 (NB17): `ui/tests/lists-chips.spec.ts` (webkit-desktop and chromium-editor; the phone has them through the same component, `chips_on_phone`) with each row's test
name, and `filters_on_the_other_lists` in `crates/wb-cli/tests/cli.rs`; `marks-legend.spec.ts` (row 40) and `marks-find.spec.ts` (row 51) were moved to the chips.

## Data the sheets show

Page titles, folders (Phinehas, Salt, Anna), their colors and the Status and Book properties are a drawn sample, never
anyone's study. The two questions in row 13 are samples. No scripture is drawn.

## Open questions

None. Questions 1–4 of round 1 were answered in round 3 (Decisions, 2026-11-22).

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-22 | rows/ (16 frames) | Chips on a list in a page, the Library's lists, phone | built (NB16) · approved 2026-11-22 |
| 2 | 2026-11-22 | rows/ (30 frames) | Step frames, what each filter means, the four ways in plain words, button-like chips, wrapping, a hundred saves, phone redrawn | built (NB16) · approved 2026-11-22 |
| 3 | 2026-11-22 | none (text only, as the person asked) | built (NB16) · approved 2026-11-22 |

## Directions

### Round 1 review (the person, 2026-11-22; review-filters-v2-round1.json)

Tally: 8 Perfect, 7 Satisfactory, 1 unrated with a comment. Worst first.

| Row | Rating | Asked | Round 2 |
|---|---|---|---|
| 16 | Satisfactory | Not intuitive; top chips go off screen; chips don't look clickable; must suit non-technical users on a phone, across the app | built (NB16) · approved 2026-11-22 |
| 11 | Satisfactory | Unclear label, frame unclear, needs before and after | built (NB16) · approved 2026-11-22 |
| 1 | Satisfactory | What do Edited, Status, Written mean; how do I get here; are custom properties a thing? | built (NB16) · approved 2026-11-22 |
| 2 | Satisfactory | What do is, is not, is empty, is not empty mean; is "All study pages" a view, and where are lists found? | built (NB16) · approved 2026-11-22 |
| 4 | Satisfactory | Many chips at screen width: wrap or squish? | built (NB16) · approved 2026-11-22 |
| 13 | Satisfactory | How do I get to the Questions list? | built (NB16) · approved 2026-11-22 |
| 3 | Satisfactory | (no comment) | built (NB16) · approved 2026-11-22 |
| 15 | (unrated) | See it with about a hundred saves of real-looking data | built (NB16) · approved 2026-11-22 |

### Approved (round 1)

Rows 5, 6, 7, 8, 9, 10, 12, 14 (Perfect, no change asked).

### Round 2 review (the person, 2026-11-22; review-filters-v2-round2.json)

Tally: 14 Perfect, 1 Satisfactory, 1 unrated. Worst first.

| Row | Rating | Asked | Round 3 |
|---|---|---|---|
| 22 | Satisfactory | What is the process of making your own property? | built (NB16) · approved 2026-11-22 |
| 13 | (unrated) | Does the Margin notes menu look the same? Chips should work the same across the whole app | built (NB16) · approved 2026-11-22 |

### Approved (round 2)

Rows 1, 2, 3, 4, 11, 15, 16, 17, 18, 19, 20, 21, 23. With round 1's 5, 6, 7, 8, 9, 10, 12, 14, that is 21 of 23 drawn
rows; 13 and 22 are answered in round 3 and the design is accepted.
