# Filters, everywhere

**State:** accepted for integration (2026-11-19) · **Round:** 3 · **Date:** 2026-11-19 · **Sheets:** `python -B design/features/filters/filters.py` writes `filters.figcraft` and `filters.pdf`.

Design one way to narrow a list or a search, then use it across the Library. The same action should feel familiar in the Notebook, in the Legend's where used list, and in Colors across the Bible. Each part offers the choices that make sense for what it shows.

## Leading design

Direction B opens an in-tab panel on a wide pane and a bottom sheet in a narrow pane, including a narrow floating tab. Both use the same single-column controls and keep Apply and Clear filters within reach while the body scrolls.

Start with B6–B8. In Notebook → All, type `prayer` in the search field. The same list narrows to 23 pages. Open **Filters**, choose the folder `Acts study`, and choose **Pages with questions → Open**. The list still shows 23 while you choose. Press **Apply** and the same list shows the five pages that match the words and both choices. Remove the folder row to look in any folder, or use **Clear filters** to return to the 23 pages. The search field still contains `prayer`.

The current list supplies the starting scope. **Questions** lists questions and offers **Status**. **All** lists pages and offers **Pages with questions**, which looks at the questions a page contains. In **Places**, **Follow the reader** tracks the current chapter, and a specific place can override it. Moving between Notebook sections restores each section's own words and applied choices for the life of the tab.

In Notebook Marks, Kind of mark can be used on its own. The Legend entry section has a search field and one entry per row, with the mark sample, name and kind. Entries stay in name order as the pane changes width. A specific kind limits the entries to that kind. A person can browse the list or type part of a name, even with hundreds of entries. Long names wrap within their own row.

The search only narrows the chooser. The selected entry stays visible in the Legend entry section when the search hides its row. Changing to an incompatible kind clears the pending entry and shows why. Applying the kind alone finds every style of that kind. Applied values appear under the results heading as one labeled row per filter, each with a removal button.

For Colors across the Bible, the same panel puts Folder and Legend entry on separate labeled rows alongside the grid. The Legend entry chooser can be browsed by kind there too. That kind limits the chooser only. Apply still sends a single style or folder to the grid.

## Decisions

- **2026-11-19, the person.** Design filtering once for the whole app. Keep the existing controls in place until this design is settled. Revisit the Notebook's Marks filter and group the controls around Colors across the Bible. [Library map, Open 4 and 6](../../LIBRARY.md) · [Marks, Out of scope / later](../marks/README.md#out-of-scope--later)
- **2026-11-19, the person.** Go with Direction B. With hundreds of choices, wrapping bubbles are hard to remember, locate or narrow to a kind of mark. Their positions also change with the pane width.
- **2026-11-19, the person.** Show how the controls work together and design filtering across Wordbench in this folder, including the Notebook's ordinary filters and the other places already offering filters.
- **2026-11-19, the person.** Begin integration from Round 3. Future feature designs may revise how the shared filters are used on their surfaces.

## The person's findings that touch it

The Library map records the feedback on the T12 Marks filter. The marks design also records the request after T14 for grouped controls and a clear layout around the grid. Round 2 addresses both concerns through the same filter panel. [Library map](../../LIBRARY.md#open-from-round-1) · [Marks](../marks/README.md#out-of-scope--later)

## Survey of today's filters

This is what the code does today. Labels in quotation marks are current window labels. Command names and flags are current spellings. A dash means the window does the narrowing itself.

| Where and files | What narrows | Controls | Today's `wb` |
|---|---|---|---|
| Notebook search · `ui/src/notebook.ts`, `ui/src/kinds.ts` | Words and result kind. The menu offers Everything, Pages, Saves, Questions, Margin notes, Highlights and Marks. Everything does not include the T12 Marks results. | Words field and kind menu with counts. | Everything uses `notebook --group none --search WORDS`. A chosen kind uses `find [WORDS] --kind KIND`. Menu counts use `find [WORDS] --sort edited`. |
| Notebook Marks results, T12 · `ui/src/kinds.ts`, `crates/wb-cli/src/study.rs` | Kind of mark, legend entry, book and date made. Color is available at the terminal. | Two menus, a book field and two date fields, shown after choosing Marks. Each changes the results as it is set. | `find [WORDS] --kind mark` with `--mark-kind`, `--style`, `--book`, `--since`, `--until`, `--color`. |
| Library search at the terminal and Find in study results · `crates/wb-cli/src/study.rs`, `crates/wb-core/src/library.rs`, `ui/src/panes.ts` | Words and, by flag, result kind, folder, pages with an open question and pages changed since a date. The effect of a flag depends on the result kind. | The window's Find in study pane uses the words. Extra flags are typed at the terminal. | `find [WORDS]` with `--kind`, `--folder`, `--has-question`, `--edited`. `--sort` orders the results. |
| Notebook lists · `ui/src/notebook.ts`, `crates/wb-cli/src/notebook.rs`, `crates/wb-cli/src/pages.rs` | Pages and Questions sections, the reader's chapter, and whether day pages appear. The separate Filters form offers page kind, place, folder, question status and days since writing. | Section buttons, Follow the reader switch, setting for days, and a folding Filters form with Apply, Clear and a line to copy. The form prints its own results. | `notebook --group … [--at …] [--no-days]`. The form uses `view run 'notebook kind … @… thread … open|answered days …'` with only the chosen parts. |
| Questions · `ui/src/notebook.ts`, `ui/src/panes.ts`, `crates/wb-cli/src/notebook.rs`, `crates/wb-cli/src/study.rs` | Questions as a Notebook section. The verse card narrows to the place. The question commands also select open, done or all. | Questions section, or open a verse card. The Notebook Filters form has a status choice. | `notebook --group questions`, `question list [--status open|done|all] [--at PLACE]`, `questions --status …`, legacy `trail list --status … --at …` in the verse card. |
| Legend where used, T11 · `ui/src/legendpane.ts`, `crates/wb-cli/src/study.rs` | One style, then book name or code as displayed in the row's book field. | Click the use count. The list has a live book field that matches part of the book string. | `legend uses ENTRY` selects the style. Book matching is local. |
| Colors across the Bible, T14 · `ui/src/colormap.ts`, `crates/wb-cli/src/study.rs` | One legend style or one colored folder. The whole grid stays visible. | A row of style and folder buttons. Click the pressed button again to clear it. | `marks map [--style ENTRY | --folder NAME]`. |
| Library folder tree and folder lists · `ui/src/shelf.ts`, `ui/src/notebook.ts`, `crates/wb-cli/src/library.rs`, `crates/wb-cli/src/study.rs` | Tree by folder name or save label. A folder with a color can narrow its saves by visible row text. | “Find in the Shelf” and “Filter places” on a folder with more than six places. | `shelf`, `folder list`, `folder show NAME` and legacy `thread show` supply data. Text narrowing is local. |
| Bible Search and Near · `ui/src/actions.ts`, `ui/src/panes.ts`, `crates/wb-cli/src/read.rs` | Bible scope. Near also uses a word distance. Search has case and regular-expression options at the terminal. | Scope comes from the typed command. The result pane shows it in the heading and has paging. | `search WORDS --scope S [--case] [--regex]`, `near A B --scope S --within N`. Both use `--offset` for paging. |
| Every use, Strong's and Concordance · `ui/src/panes.ts`, `ui/src/concordance.ts`, `crates/wb-cli/src/read.rs` | Bible scope, match category and KJV rendering for Every use. One or all English forms and a book for Concordance. | Scope typed in the command, category buttons in Every use, rendering buttons on the Strong's entry, forms switch and book “more” in Concordance. | `uses TERM [--word WORD] [--scope S] [--cat CAT] [--rendering WORD]`, `concordance WORD [--forms all|one] [--book B]`. |
| Highlights list and reader · `ui/src/actions.ts`, `ui/src/panes.ts`, `ui/src/main.ts`, `ui/src/reader.ts` | The older highlights list narrows by color, folder with a color and Bible scope. Reader controls show or hide kind of mark, legend entry and folder color, or use Reading mode. | Typed `marked` command or “Your highlights, listed”. Highlights menu, folder name field and visibility switches in the reader. | `hl list [--color C] [--thread NAME]`, with scope applied locally. `settings marks kind/entry/reading` and `folder shown` set visibility. |
| Legend chooser and verse card · `ui/src/markbar.ts`, `ui/src/versemarks.ts` | The chooser matches a style's name or kind. The card shows marks and margin notes at its verse. | “Find a style” in the Legend drop-down or phone sheet. The verse card has no filter control. | Chooser reads `legend` and matches locally. Card data comes from the verse lookup or `mark at REF`. |
| Saved lists today · `ui/src/blocks.ts`, `ui/src/notebook.ts`, `crates/wb-cli/src/pages.rs` | The same Notebook filters supported by a line, with words and other page choices. | Edit the line in a page block or run it in the command field. | `view run LINE`, `page views ID`, `block view ID N LINE`. |
| Findings and Trash · `ui/src/findings.ts`, `ui/src/notebook.ts`, `crates/wb-cli/src/notebook.rs` | Findings by tag and whether handled. Trash by text, reference or ID. | Tag buttons and handled toggle; Trash search field. | `findings [--all] [--tag TAG]`. `trash` supplies rows for local search. |
| Other narrow lists · `ui/src/main.ts`, `ui/src/panes.ts`, `ui/src/notebook.ts`, `ui/src/shelf.ts`, `ui/src/blocks.ts`, `ui/src/plans.ts`, `ui/src/settings.ts`, `ui/src/rail.ts`, `ui/src/dock.ts`, `ui/src/command.ts` | Page and folder names in choosers, choices in a page or reading plan, settings rows, tabs and command suggestions. | Local text fields or type-ahead. | Local matching on data already loaded. |
| Find in the current chapter or pane and the trail · `ui/src/main.ts`, `ui/src/panefind.ts`, `ui/src/trail.ts`, `crates/wb-cli/src/notebook.rs` | Text already on screen. The trail loads earlier steps by time. | Find fields move among matches. The trail offers earlier steps. | Find is local. `history list --days N` selects a time window. |
| Other terminal lists · `crates/wb-cli/src/docs.rs`, `crates/wb-cli/src/notebook.rs`, `crates/wb-cli/src/read.rs` | Documents by source, placed pages by words, journal by day, Strong's entries by language and starting entry. | Typed arguments. The page document list already has a fixed source. | `docs list --page/--thread/--lesson`, `note all [WORDS]`, `journal [DATE]`, `strong --list hebrew|greek [--from NUMBER]`. |

## What goes wrong today

- A book is a field under Marks, part of a book string in Legend where used, and part of a typed scope in Bible Search. Someone learns three ways to ask for the same book.
- A choice can take effect on typing, on changing a field, on clicking a color, or on Apply. Leaving the controls does not always leave a clear record of what is active.
- T12 puts its controls under a kind menu, and T14 puts every style and folder choice above the grid. The person wants choices that stay organized and easy to narrow as the list grows and the pane changes width.

## Open questions

- Does the Notebook walkthrough match how you want words and filters to combine? The draft keeps words visible and applies filter choices together with Apply.
- When you move between All, Places and Questions, should each section remember its own words and filters as drawn, or should some choices follow you between sections?
- In Places, should Clear filters return to the configured Follow the reader default? The draft shows a fixed place overriding Follow the reader until that filter is removed.
- When changing kind excludes the selected entry, is clearing the entry with a notice the right behavior?
- Should clearing filters in Where used keep the Legend entry you opened?
- Should Colors across the Bible keep one style or folder at a time?
- Should filters reset when a tab closes, or reopen as last left?
- Should the first saved lists cover just the Notebook, or also search results?
- Can the shared button say “Filters”, and should a mark's date say “Made”?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-19 | None | Survey and three directions | B chosen |
| 2 | 2026-11-19 | B1–B5 | Search and kind for a large Legend, stable rows at different widths, applied values and the color grid | Ready for review |
| 3 | 2026-11-19 | B6–B17, plus B1–B5 | Notebook before, during and after Apply. Shared controls and starting scope across the app. | Accepted for integration |

## Directions

### B. One Filters button

Desktop opens a side panel within the current tab. A narrow tab or phone opens a bottom sheet with the same sections. Click or tap Filters, or reach it with Tab and press Enter or Space. Book and place, folder, dates and other sections keep the same order wherever they appear. Only applicable sections appear.

Choose values and press Apply. The button shows the active count. Beneath it, each applied value has a labeled removal button on its own row in the panel's section order. Remove one there or use Clear filters in the panel. The panel shows pending edits until Apply. Escape or Close discards pending edits. The Bible reader stays where it is.

Apply sends the choices for the current list. Text search narrows by words. Each applied filter adds a condition the same result must meet. Sort or Other forms operates in its own control where the current feature already offers it, and paging advances within the matching results. After a filter changes, a paged result returns to page one. The result count describes rows in the current list, and the number on Filters counts explicit applied choices. The starting scope is visible in the heading or context line and is restored by Clear filters.

### Notebook sections and scope

**All** starts with the Notebook's pages. Offer Page kind (Any, regular pages, day pages, question pages, folder pages), Pages with questions (Any, Open, Answered), Book and place, Folder, and Written (Any date or the last N days). Book and place accepts a Bible reference or a Strong's number where the current Notebook already accepts one. A folder picker searches names and keeps them in a single ordered list like the Legend chooser.

**Days** keeps the pages grouped by day written, with each day's page first. Offer Page kind, Folder, Pages with questions and Written where applicable. **Pages** starts with unplaced pages. Offer Page kind, Pages with questions, Folder and Written. **Places** keeps Bible order and offers the same page choices as All on top of its place scope. Its Book and place offers Any place, Follow the reader, or a fixed reference. A fixed place holds when the reader moves. Clearing it restores the Places setting. **Questions** offers Status (Any, Open, Answered) and Book and place. The verse card keeps its verse fixed when offering Status.

The Notebook list's text field searches within the section you opened. **Find in study** beside that field opens the existing mixed-results pane with the same words for searching across kinds. The broader pane starts with its own defaults. There, selecting Pages enables page filters, and selecting Marks enables mark filters. Changing the kind removes any inapplicable choices from the pending panel. The list updates when you apply the new combination.

The Notebook page lists offer Copy list command and Keep as a list in a page from ⋯. The query includes the section, words and applied choices. Follow the reader records the current reference at the moment you copy or save. The saved list stays limited to the captured page scope and shows its usual page rows. Questions can still be searched and filtered in their own section.

### Where the shared panel goes

| Surface | Starting scope | Choices in Filters | What the result does |
|---|---|---|---|
| Notebook pages, Days and Places · B6–B8, B10 | Selected Notebook section | Page kind, Pages with questions, Book and place, Folder, Written as applicable | Update the same list in its section and keep its grouping. |
| Questions and verse card · B9 | Questions section or the verse on the card | Status, Book and place where the verse is not fixed | List matching questions. Open and Answered on pages remain a separate choice. |
| Find in study · B12 | Mixed results and the entered words | Result kind, then its page or mark choices. Saves offer Folder and Book and place. Questions offer Status and Book and place. Folders offer Result kind only. | Keep the words and existing sort order. The unified search design owns future entry points and coverage. |
| Folder tree and opened folders · B13 | All folders or the opened folder | Result kind and Book and place for opened folders with placed saves. The tree uses its existing text field. | The tree keeps ancestors of matches. The opened list keeps the folder heading and save order. A text edit narrows within the current folder. |
| Bible Search and Near · B11 | Original words or pair of words | Book and place including testament or existing scope. Match case and Regular expression for Search. Distance for Near. | Refresh page one and the count. Keep the original query in view. |
| Every use and Concordance · B14 | The selected Strong's entry or English word | Book and place, category and KJV rendering where supported. Concordance English page offers Book; its word forms switch stays beside the word. | Keep the entry fixed. The count reflects the filtered uses or English occurrences. Group by, More and counts per book keep their current roles. |
| Marks and older Highlights list · B1–B4, B17 | Marks results or highlights-only list | Kind of mark, Legend entry, Book and place, Made, color as available. Older Highlights offers Color, Book and place, and Folder. | Same search results or highlight list, in its existing result order. |
| Legend Where used · B16 | The opened Legend entry | Book and place | Narrow the uses of the same entry. |
| Colors across the Bible · B5 | All chapters | Folder or Legend entry, with kind and name to browse entries | Keep all chapters and their gaps visible. Choosing a style replaces the folder choice and vice versa. |
| Findings · B15 | Open findings | Status (Open or Include handled) and Tag | Refresh the same list, newest first. Keep all available tags in the picker, even when one is applied. |
| Saved lists | The query already in the page block | Edit the list's supported choices, or keep a new list from the Notebook's current words and filters | Apply in the Notebook reads only. Explicitly saving or editing a list writes its query to the selected page. Existing lines keep running. |

### Other ways to narrow or move through the app

| Surface | Design in this round |
|---|---|
| Trash, folder tree, settings search | Keep the single text field where it updates the visible list. Clear the text in that field to show the full list again. |
| Page, folder, Legend and reading-plan choosers, and command suggestions | Keep the search within the chooser. Use the same stable single-column list for long name lists. Selecting a choice continues the action that opened the chooser. |
| Find in a chapter or pane, the trail, Reader visibility | Keep Find's next and previous match, the trail's Earlier steps, and the Reader's mark-layer controls on their own surfaces. These move through existing items or change what is drawn. |
| Documents by source, the journal, and Strong's lists at the terminal | Keep their current flags and entry points. A page's documents already start at that page, the journal starts on its selected day, and the Strong's alphabet and number controls navigate their book. |

### In a large Legend

The chooser shows the count of matching entries and a bounded, scrollable list. Search matches part of the displayed name without regard to case. The order is by name, with ties broken by kind and the stable style identifier. Each row is reachable by keyboard. Display the kind even when the list has been narrowed. Closing and reopening the panel starts the chooser with an empty name search and the applied choices loaded.

### Shared choices and command flags

Proposed spellings below. Each command accepts only its applicable choices. Keep existing command spellings readable, including old saved list lines. A choice has one value in this round. Choices on different dimensions all have to match. Options unavailable for a result kind are omitted in the window and rejected with a message if requested at the terminal.

| Choice | Shared `wb` flags | Proposed surfaces |
|---|---|---|
| Kind | `--kind` | Library and Notebook search (page, folder, save, question, mark, or margin note where available). Notebook lists and folder lists can offer a kind where they hold different things. |
| Kind of mark, Legend entry, Color | `--mark-kind`, `--style`, `--color` | Marks results. Where used starts with its entry fixed. Colors across the Bible offers Legend entry for the mark side. Color of a mark is separate from a folder's color. |
| Book and place | `--book BOOK`, `--at PLACE` | Bible Search, Marks, where used, Notebook lists, Questions and folder saves with a Bible place. `--at` can name a chapter or range. A mark or save matches a range it touches. The color grid keeps the whole Bible in view. |
| Folder | `--folder NAME` | Library and Notebook results with folder membership, plus the colored folder choice in the grid. Unfiled selects saves in Unfiled once that folder is available. An opened folder supplies its own scope. |
| Written or made, changed | `--since` / `--until`, `--changed-since` / `--changed-until` | Written for Notebook pages and made for Marks. Changed for pages in Library or Notebook results. Offer a date choice only where that date exists. Dates include both ends. |
| Question status | `--status open\|done\|all` | Questions and Notebook or Library results for questions. `find --has-question` retains its current meaning. |
| Word and result choices already in use | `--scope`, `--cat`, `--rendering`, `--forms`, `--within`, `--case`, `--regex` | Keep these command options for the lists they serve. Use the shared panel when adding or moving their window controls. Words remain in the search field. |

In where used, a visible heading keeps the Legend entry in view. Clear removes any added place choice. In Colors across the Bible, choosing a Legend entry replaces a folder choice, and choosing a folder replaces an entry. The full grid keeps its gaps. Clear restores the full grid with all styles and folder colors. These are draft behaviors.

For a Notebook page list, propose `wb notebook --view LINE` for the section grouping and `wb view run LINE` for the same matches as a flat saved list. The line can include a `section all|days|pages|places` choice and `page-questions open|answered`. The new page-questions choice selects the page that contains a matching question. Existing lines using `open` or `answered` continue selecting question rows. Use the existing saved-list form for words, `@place`, `kind`, and `days N`, and allow `folder NAME` for Library folders while retaining `thread NAME` for old queries. A copied line with words that coincide with filter keywords quotes them as literal search words, with a round-trip test for the parser.

## Data the sheets show

The board uses fictional page titles, folders, Legend entries and counts. The Marks sheets use a sample with 240 Legend entries. Bible and Concordance result rows show references without quoting Scripture.

## The real conditions

| Window | What it shows |
|---|---|
| B1 | Notebook Marks among other tabs, with a kind selected and 68 of 240 entries available in the scrolling chooser |
| B2 | Narrow floating tab, with the same controls and a long name on its own row |
| B3 | Phone sheet, with a name search narrowed to three entries |
| B4 | Applied values in stable rows and a results area with no matches |
| B5 | Colors across the Bible, with the Legend entry and Folder controls grouped in the panel and the chapter grid in view |
| B6–B8 | Notebook All in sequence. Words entered, filter choices pending, then the same list with the applied choices. |
| B9 | Questions on the phone. Status and place in a bottom sheet. |
| B10 | Notebook Places. A fixed reference overrides Follow the reader. |
| B11 | Bible Search. Place and match options next to the results. |
| B12 | Find in study. Result kind Pages exposes page choices. |
| B13 | An opened folder. Its name and the words remain when applying a place. |
| B14 | Concordance. Book filter alongside the word and its forms control. |
| B15 | Findings. Status and Tag replace the tag bubbles. |
| B16 | Legend Where used. Book and place beneath a fixed entry. |
| B17 | Highlights. The same place and folder controls alongside color. |

## Interaction table

Round 3 draft for B. Shared actions apply wherever offered. Use the listed command for that part. When removing the result kind makes other choices unavailable, remove those choices too. Keep the words and any remaining applicable choices. Newly proposed flags are subject to design review.

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 1 | Results heading | Click or tap Filters | Panel or phone sheet opens with the applied choices loaded. | Nothing | Window only | `filters_open_in_tab_or_phone_sheet` | [x] F1 |
| 2 | Results heading | Tab to Filters, then Enter or Space | The same controls open and focus moves to the first control. | Nothing | Window only | `filters_open_with_keyboard` | [x] F1 |
| 3 | Filters | Add or change a choice by click, tap or keyboard | The pending choice is labeled. The applied count and results stay in place. | Nothing | Apply runs the flags from rows 4 and 9–13. | `filters_hold_choices_until_apply` | [x] F1 |
| 4 | Notebook search | Press Apply with kind, mark choices, place or date selected | Results refresh, the panel closes and the heading shows the active choices. Focus returns to Filters. | Nothing | `wb find --kind mark --style Promise --book John` (plus applicable flags above) | `marks_apply_shared_flags` | [ ] |
| 5 | Filters | Click or tap Close, or press Escape | The panel closes, pending edits are discarded and focus returns to Filters. | Nothing | Window only | `filters_close_discards_pending_choices` | [ ] |
| 6 | Applied values | Activate × by click, tap or keyboard | That value disappears, focus moves to the next removal button or Filters, and results refresh. | Nothing | Rerun the part's command without that flag. | `filters_remove_one_keeps_the_others` | [ ] |
| 7 | Filters | Activate Clear filters | Applied and pending choices clear. The panel closes, results return to their starting scope and focus returns to Filters. Words stay in the search field. | Nothing | Rerun the part's command without optional filter flags. | `filters_clear_keeps_words_and_starting_scope` | [ ] |
| 8 | Filters or results | Apply an invalid value or a valid choice with no matches | A bad value gets an explanation and focus stays on its control. A valid empty result keeps the active choices and says nothing matches. If the command fails to load, keep the last results and show the error. | Nothing | The current list command returns an error or an empty result for the supplied flags. | `filters_distinguish_invalid_and_empty` | [ ] |
| 9 | Legend where used | Apply a book or place | Only marks in the chosen place appear. The starting entry stays visible. | Nothing | `wb legend uses Promise --book John` | `legend_uses_filters_with_its_entry_fixed` | [ ] |
| 10 | Colors across the Bible | Apply a Legend entry or colored folder | The grid keeps every chapter and shows gaps. A new entry or folder replaces the other choice. | Nothing | `wb marks map --style Promise` or `wb marks map --folder NAME` | `colors_apply_keeps_gaps_and_one_choice` | [ ] |
| 11 | Bible Search results | Apply a book or chapter range | Page one and its count reflect the chosen place. Words and other search choices stay in effect. | Nothing | `wb search WORDS --book John` or `wb search WORDS --at "John 1-3"` | `bible_search_place_resets_results_page` | [ ] |
| 12 | Notebook lists and Questions, B8–B10 | Apply the offered choices | The current list refreshes in place and keeps its heading and grouping. Notebook page choices match pages, and Questions status matches questions. | Nothing | `wb notebook --view 'notebook section all prayer folder "Acts study" page-questions open'`. In Questions, `wb question list --status done --at PLACE` selects answered questions. | `notebook_and_questions_use_shared_choices` | [x] F1 All and Questions |
| 13 | Library search and folder lists | Apply a kind or folder where offered | The Library shows matching results. A folder tree keeps the folders needed to reach matching rows. A folder opened by name keeps that scope. | Nothing | `wb find --folder NAME --kind save` or `wb folder show NAME --kind save` | `library_filters_keep_matching_rows_reachable` | [ ] |
| 14 | Notebook list menu | Choose “Keep as a list in a page” | A page chooser opens with the applied line ready. | Nothing | Window only | `saved_list_offers_page_choice` | [ ] |
| 15 | Page chooser | Confirm the page | The page receives a saved list that runs the applied line. | One block with the line in the chosen page. | `wb block add PAGE BLOCK` with a `view` fence holding the line from row 12. | `saved_list_keeps_line_and_refreshes_results` | [ ] |
| 16 | Page chooser | Cancel or press Escape | The chooser closes and focus returns to the list menu. | Nothing | Window only | `saved_list_cancel_keeps_page_untouched` | [ ] |
| 17 | Filtered results | Open a result or a chapter cell, then go Back | The reader opens at the result. Back restores the reader's prior place and the originating list keeps its choices. | Ordinary trail step from opening the result. | Existing open and back commands for that result. | `filtered_result_back_keeps_reader_place` | [ ] |
| 18 | Notebook Marks, B1–B3 | Choose Any kind or a kind of mark | The Legend entries narrow to the kind, in the same name order. If the pending entry belongs to another kind, it clears with a notice. The kind can be applied by itself. | Nothing | Apply uses `wb find --kind mark --mark-kind KIND` with any remaining flags. | `marks_kind_scopes_entries_and_can_apply_alone` | [ ] |
| 19 | Legend entry, B1–B3 and B5 | Type or clear a name search | Only the chooser changes. The count updates, and a zero-match search says no Legend entries match. The selected entry remains visible above the list. | Nothing | The chooser reads `wb legend`. | `legend_name_search_keeps_pending_selection` | [ ] |
| 20 | Legend entry, B1–B3 and B5 | Scroll or move through the list with the keyboard, then choose an entry or Any entry | Each option stays on its own row with a sample, name and kind. The pending choice appears above the list and the result set stays in place until Apply. | Nothing | Apply uses `--style` for a specific entry. Any entry omits the flag. | `legend_rows_keep_order_and_selection_across_widths` | [ ] |
| 21 | Colors across the Bible, B5 | Pick a kind within the Legend entry chooser | The chooser shows only entries of that kind. The chosen style or folder and the grid stay in place. | Nothing | The chooser reads `wb legend`. | `colors_kind_browses_styles_without_filtering_grid` | [ ] |
| 22 | Notebook section, B6–B8 | Type or clear the Notebook words | The active section's list narrows or widens using the applied filters. Its heading and any groups stay in place. | Nothing | `wb notebook --view LINE` with the words in the line, or `wb question list --search WORDS` with the active question scope. | `notebook_words_search_within_the_current_section` | [x] F1 All and Questions |
| 23 | Notebook sections | Switch sections and return | Each section restores its own words and applied choices. Close and reopen the tab to start at its defaults. | Nothing | Same section command with its own choices. | `notebook_sections_keep_separate_filter_state` | [ ] |
| 24 | Notebook Places, B10 | Apply Any place, Follow the reader, or Specific place, then move the reader | Any place shows placed pages across the Bible. Follow reruns against the current chapter. A fixed reference stays set. Clear restores the configured default. | Nothing | Proposed `wb notebook --view 'notebook section places [@PLACE]'`. The window supplies the current chapter while following. | `notebook_place_filter_overrides_follow_until_cleared` | [ ] |
| 25 | Notebook Filters, B7, and folder choosers inside Filters | Search for and choose a folder by name | One ordered row per matching folder, selected label retained. Only applying changes the results. | Nothing | Read `wb folder list`; pass the selected folder to the surface's command. | `folder_picker_scales_and_keeps_selected_identity` | [ ] |
| 26 | Notebook list menu | Copy list command | The clipboard receives the command for the current words and applied choices. With Follow the reader it uses the current reference. | Clipboard only | `wb view run LINE` runs the copied Notebook list query. | `copy_list_uses_applied_values_and_current_reference` | [ ] |
| 27 | Findings, B15 | Apply or clear Status and Tag | The same list refreshes. The tag picker can still see other tags. Clear shows open findings across tags. | Nothing | `wb findings [--all] [--tag TAG]`. Read `wb findings --all` for chooser tags. | `findings_filters_keep_all_tags_reachable` | [ ] |
| 28 | Bible Search and Near, B11 | Apply Match case, Regular expression or Distance where offered | The original words stay visible and matching starts at page one. | Nothing | `wb search WORDS [--case] [--regex]` or `wb near A B --within N`, with the chosen scope. | `bible_result_options_keep_words_and_reset_page` | [ ] |
| 29 | Every use and Concordance, B14 | Apply or remove a book, category or KJV rendering where offered | The word or entry stays open and the counts reflect the filtered occurrences. The forms control remains available in Concordance. | Nothing | `wb uses TERM [--scope S] [--cat CAT] [--rendering WORD]` or `wb concordance WORD --book B` with current `--forms`. | `reference_work_filters_keep_entry_and_match_counts` | [ ] |
| 30 | Find in study, B12 | Select or change Result kind | The pending panel shows only choices for that kind. Inapplicable pending choices clear. The result count changes on Apply. | Nothing | `wb find [WORDS] --kind KIND` with that kind's supported flags. | `result_kind_controls_which_choices_are_available` | [ ] |
| 31 | Opened folder, B13 | Type words, then apply a place | The same opened folder shows matching saves in folder order. Removing the place keeps the words and folder. | Nothing | `wb folder show NAME` with proposed `--search WORDS --at PLACE`. | `opened_folder_combines_words_and_place_in_folder_order` | [ ] |
| 32 | Highlights list, B17 | Apply Color, Book and place, or Folder | The Highlights list stays open and shows highlights matching the applied choices. | Nothing | `wb hl list [--color C] [--thread NAME]` with proposed `--at PLACE` for the existing place narrowing. | `highlights_list_filters_keep_the_same_list` | [ ] |
| 33 | Notebook, B6–B8 | Activate Find in study beside the words by click, tap or keyboard | The mixed-results pane opens with the words and its own default scope. The Notebook keeps its section and current choices. | Nothing | `wb find WORDS` with its default scope. | `find_in_study_carries_words_from_notebook` | [ ] |

## What the build must satisfy

- [ ] The same Filters action, section order, active values, Apply and Clear work on desktop and phone. Tab can reach every action. Focus returns to the originating control.
- [ ] Every offered choice gives the same results in the window and through its `wb` command. Existing command lines and saved lists still run.
- [ ] Applying one tab's choices leaves other tabs' filters as they were. Ordinary filtering writes no study files. Keeping a saved list writes only the chosen page block.
- [ ] Where used holds its entry. Colors across the Bible keeps gaps and offers the same chapter navigation. Returning from any result keeps the reader's place.
- [ ] Bad values show an error. Valid empty results show the active choices so the person can remove them.
- [ ] With 240 Legend entries, a person can browse by kind, search by name, and apply a kind alone in Notebook Marks. The order and selected label stay stable from a docked pane to a floating tab to a phone. (B1–B3)
- [ ] Applied values remain in the same order at all widths, with one removal button per row. A long name wraps within its row. (B2–B4)
- [ ] The Notebook has one results list per section. Words, pending choices, applied choices and starting scope stay visible or recoverable as shown in B6–B10.
- [ ] Every existing filter surface has the choices in the coverage table. Result counts and paging agree with the applied choices. (B5, B11–B17)

## Tickets

| Ticket | Rows | First proof |
|---|---|---|
| F1 | 1–3, 12, 22 | Start in Notebook All. Words and filters narrow the same list on desktop and phone. |
| F2 | 5–8 | Close, remove and clear around the Notebook list. Keep words and distinguish empty from invalid. |
| F3 | 23–25 | Notebook section independence, Places and searchable folders. |
| F4 | 14–16, 26 | Copy or keep the Notebook's applied list. |
| F5 | 4, 18–20 | Marks finds a kind or a named Legend entry in a long list. |
| F6 | 9–10, 21, 32 | Legend, color grid and Highlights reuse controls and keep their scope. |
| F7 | 11, 28–29 | Bible Search, Near and reference-work result filters. |
| F8 | 13, 30–31, 33 | Find in study from the Notebook, result kind and opened folders. |
| F9 | 17, 27 | Findings and Back across adopted surfaces. |

## Out of scope / later

- The Library search redesign decides where its search lives and what it searches. The Filters panel works with the list it is given. [Search](../search/README.md)
- The coverage table records how adjacent controls relate to Filters. Their existing sorting, paging, navigation and reader visibility behavior belongs to their own feature designs.
- New kinds of marks, a new color grid layout, changes to question discovery, and changes to how files are kept belong to their feature designs.
