# Filters, everywhere

**State:** exploring · **Round:** 1 · **Date:** 2026-11-19 · **Sheets:** none yet. FigCraft sheets follow the person's choice.

Design one way to narrow a list or a search, then use it across the Library. The same action should feel familiar in the Notebook, in the Legend's where used list, and in Colors across the Bible. Each part offers the choices that make sense for what it shows.

## Leading design

B is the Round 1 recommendation. No direction has been accepted.

## Decisions

- **2026-11-19, the person.** Design filtering once for the whole app. Keep the existing controls in place until this design is settled. Revisit the Notebook's Marks filter and group the controls around Colors across the Bible. [Library map, Open 4 and 6](../../LIBRARY.md) · [Marks, Out of scope / later](../marks/README.md#out-of-scope--later)

## The person's findings that touch it

The Library map records that the person “really don't like” the T12 Marks filter. The marks design also records the request after T14 for grouped controls and a clear layout around the grid. The reason for disliking T12 is still open. [Library map](../../LIBRARY.md#open-from-round-1) · [Marks](../marks/README.md#out-of-scope--later)

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
- T12 puts five controls under a kind menu. The separate Notebook Filters form uses a different layout and gives its results a separate place. T14 puts every style and folder choice above the grid. These are observations about the controls. What bothered the person most in T12 is open.

## Open questions

1. Which direction should get sheets, A, B or C?
2. What bothered you most in T12?
3. Should changes wait for Apply or take effect as you choose?
4. Should clearing filters in where used keep the Legend entry you opened?
5. Should Colors across the Bible keep one style or folder at a time?
6. Should filters reset when a tab closes, or reopen as last left?
7. Should the first saved lists cover just the Notebook, or also search results?
8. Can the shared button say “Filters”, and should a mark's date say “Made”?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-19 | None | Survey and three directions | Choice pending |

## Directions

### A. One typed line with editable choices

Desktop puts `kind:mark style:Promise book:John` beside the words. Click the line or reach it with Tab. Enter accepts a typed choice or a suggestion. Accepted choices become small labeled buttons. Click a label to edit it or use its × to remove it. Tab and Enter reach both. Clear removes the choices. On a phone, tap the line to edit it in a bottom sheet. Applied choices can wrap under the search.

Each accepted choice becomes the corresponding shared flag below. For example, this line runs `wb find --kind mark --style Promise --book John`. It is quick to type and easy to copy. People must learn the syntax or use suggestions, including how names with spaces work. On a phone, the keyboard leaves less room for the results.

### B. One Filters button

Desktop opens a side panel within the current tab. A narrow tab or phone opens a bottom sheet with the same sections. Click or tap Filters, or reach it with Tab and press Enter or Space. Book and place, folder, dates and other sections keep the same order wherever they appear. Only applicable sections appear.

Choose values and press Apply. The button shows the active count. Beneath it, each applied value has a labeled removal button. Remove one there or use Clear filters in the panel. The panel shows pending edits until Apply. Escape or Close discards pending edits. The Bible reader stays where it is.

Apply sends the shared flags for that list. Marks, where used, and the color grid keep their own commands and result shapes. This adds a click for a single filter and temporarily covers part of a phone screen. It groups long sets of choices and gives each value a visible label.

### C. One row where choices are added

Desktop keeps a short row beside the list heading. Click or Tab to Filters and press Enter or Space to pick a dimension and then a value. Each choice takes effect immediately and appears as a labeled button with ×. Clear filters empties the row. On a phone, the picker opens as a short bottom sheet for one choice at a time. The row wraps below the heading.

Each choice or removal reruns the same command with the shared flags. This keeps a small result list visible while adding a filter. Combining several values takes several trips through the picker. A long row can crowd the result heading, and immediate changes can make the list move while someone is still choosing.

### Recommendation

Start with B. A person can see the available choices without learning a query format. The same layout holds five Marks controls or a long list of Legend entries. Apply gives the person one point to review several choices, and the active values stay visible beside the results. A favors repeat typing. C favors changing one value at a time.

### Shared choices and command flags

Proposed spellings below. Each command accepts only its applicable choices. Keep existing command spellings readable, including old saved list lines. A choice has one value in Round 1. Choices on different dimensions all have to match. Options unavailable for a result kind are omitted in the window and rejected with a message if requested at the terminal.

| Choice | Shared `wb` flags | Proposed surfaces |
|---|---|---|
| Kind | `--kind` | Library and Notebook search (page, folder, save, question, mark, or margin note where available). Notebook lists and folder lists can offer a kind where they hold different things. |
| Kind of mark, Legend entry, Color | `--mark-kind`, `--style`, `--color` | Marks results. Where used starts with its entry fixed. Colors across the Bible offers Legend entry for the mark side. Color of a mark is separate from a folder's color. |
| Book and place | `--book BOOK`, `--at PLACE` | Bible Search, Marks, where used, Notebook lists, Questions and folder saves with a Bible place. `--at` can name a chapter or range. A mark or save matches a range it touches. The color grid keeps the whole Bible in view. |
| Folder | `--folder NAME` | Library and Notebook results with folder membership, plus the colored folder choice in the grid. Unfiled selects saves in Unfiled once that folder is available. An opened folder supplies its own scope. |
| Written or made, changed | `--since` / `--until`, `--changed-since` / `--changed-until` | Written for Notebook pages and made for Marks. Changed for pages in Library or Notebook results. Offer a date choice only where that date exists. Dates include both ends. |
| Question status | `--status open|done|all` | Questions and Notebook or Library results for questions. A page containing a question is a separate existing `--has-question` choice, with its own rules. |
| Word and result choices already in use | `--scope`, `--cat`, `--rendering`, `--forms`, `--within`, `--case`, `--regex` | Keep these command options for the lists they serve. Use the shared panel when adding or moving their window controls. Words remain in the search field. |

In where used, a visible heading keeps the Legend entry in view. Clear removes any added place choice. In Colors across the Bible, choosing a Legend entry replaces a folder choice, and choosing a folder replaces an entry. The full grid keeps its gaps. Clear restores the full grid with all styles and folder colors. These are draft behaviors.

## Data the sheets show

No sheet data yet. Use a scratch study folder and fetch any Scripture and lookups through `wb` when drawing the sheets.

## The real conditions

Draw B among other tabs, in a floating tab, and as a phone sheet. Use a Library with years of study. Show long names, many Legend entries, no matches, and a chapter with marks in more than one style.

## Interaction table

Draft for B. One row describes the shared action wherever it is available. Use the listed command for that part. If removing Kind makes other choices unavailable, remove those choices too. Keep the words and any remaining applicable choices. Flags added to existing commands and the saved-list line are proposals.

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 1 | Results heading | Click or tap Filters | Panel or phone sheet opens with the applied choices loaded. | Nothing | Window only | `filters_open_in_tab_or_phone_sheet` | [ ] |
| 2 | Results heading | Tab to Filters, then Enter or Space | The same controls open and focus moves to the first control. | Nothing | Window only | `filters_open_with_keyboard` | [ ] |
| 3 | Filters | Add or change a choice by click, tap or keyboard | The pending choice is labeled. The applied count and results stay in place. | Nothing | Apply runs the flags from rows 4 and 9–13. | `filters_hold_choices_until_apply` | [ ] |
| 4 | Notebook search | Press Apply with kind, mark choices, place or date selected | Results refresh, the panel closes and the heading shows the active choices. Focus returns to Filters. | Nothing | `wb find --kind mark --style Promise --book John` (plus applicable flags above) | `marks_apply_shared_flags` | [ ] |
| 5 | Filters | Click or tap Close, or press Escape | The panel closes, pending edits are discarded and focus returns to Filters. | Nothing | Window only | `filters_close_discards_pending_choices` | [ ] |
| 6 | Applied values | Activate × by click, tap or keyboard | That value disappears, focus moves to the next removal button or Filters, and results refresh. | Nothing | Rerun the part's command without that flag. | `filters_remove_one_keeps_the_others` | [ ] |
| 7 | Filters | Activate Clear filters | Applied and pending choices clear. The panel closes, results return to their starting scope and focus returns to Filters. Words stay in the search field. | Nothing | Rerun the part's command without optional filter flags. | `filters_clear_keeps_words_and_starting_scope` | [ ] |
| 8 | Filters or results | Apply an invalid value or a valid choice with no matches | A bad value gets an explanation and focus stays on its control. A valid empty result keeps the active choices and says nothing matches. If the command fails to load, keep the last results and show the error. | Nothing | The current list command returns an error or an empty result for the supplied flags. | `filters_distinguish_invalid_and_empty` | [ ] |
| 9 | Legend where used | Apply a book or place | Only marks in the chosen place appear. The starting entry stays visible. | Nothing | `wb legend uses Promise --book John` | `legend_uses_filters_with_its_entry_fixed` | [ ] |
| 10 | Colors across the Bible | Apply a Legend entry or colored folder | The grid keeps every chapter and shows gaps. A new entry or folder replaces the other choice. | Nothing | `wb marks map --style Promise` or `wb marks map --folder NAME` | `colors_apply_keeps_gaps_and_one_choice` | [ ] |
| 11 | Bible Search results | Apply a book or chapter range | Page one and its count reflect the chosen place. Words and other search choices stay in effect. | Nothing | `wb search WORDS --book John` or `wb search WORDS --at "John 1-3"` | `bible_search_place_resets_results_page` | [ ] |
| 12 | Notebook lists and Questions | Apply place, folder, date or question status where offered | The current list refreshes in place and keeps its heading. | Nothing | `wb view run 'notebook --folder NAME --since DATE'` or `wb question list --status done --at PLACE` | `notebook_and_questions_use_shared_choices` | [ ] |
| 13 | Library search and folder lists | Apply a kind or folder where offered | The Library shows matching results. A folder tree keeps the folders needed to reach matching rows. A folder opened by name keeps that scope. | Nothing | `wb find --folder NAME --kind save` or `wb folder show NAME --kind save` | `library_filters_keep_matching_rows_reachable` | [ ] |
| 14 | Notebook list menu | Choose “Keep as a list in a page” | A page chooser opens with the applied line ready. | Nothing | Window only | `saved_list_offers_page_choice` | [ ] |
| 15 | Page chooser | Confirm the page | The page receives a saved list that runs the applied line. | One block with the line in the chosen page. | `wb block add PAGE BLOCK` with a `view` fence holding the line from row 12. | `saved_list_keeps_line_and_refreshes_results` | [ ] |
| 16 | Page chooser | Cancel or press Escape | The chooser closes and focus returns to the list menu. | Nothing | Window only | `saved_list_cancel_keeps_page_untouched` | [ ] |
| 17 | Filtered results | Open a result or a chapter cell, then go Back | The reader opens at the result. Back restores the reader's prior place and the originating list keeps its choices. | Ordinary trail step from opening the result. | Existing open and back commands for that result. | `filtered_result_back_keeps_reader_place` | [ ] |

## What the build must satisfy

- [ ] The same Filters action, section order, active values, Apply and Clear work on desktop and phone. Tab can reach every action. Focus returns to the originating control.
- [ ] Every offered choice gives the same results in the window and through its `wb` command. Existing command lines and saved lists still run.
- [ ] Applying one tab's choices leaves other tabs' filters as they were. Ordinary filtering writes no study files. Keeping a saved list writes only the chosen page block.
- [ ] Where used holds its entry. Colors across the Bible keeps gaps and offers the same chapter navigation. Returning from any result keeps the reader's place.
- [ ] Bad values show an error. Valid empty results show the active choices so the person can remove them.

## Tickets

| Ticket | Rows | First proof |
|---|---|---|
| F1 | 1–4 | One panel on Marks. Desktop, phone and marks command tests agree. |
| F2 | 5–8 | Marks supports closing, removing, clearing and empty or invalid results. |
| F3 | 9–10 | Legend and color grid use the same controls and preserve their starting scope and gaps. |
| F4 | 11–12 | Bible Search, Notebook lists and Questions use the shared place and list choices. |
| F5 | 13, 17 | Library lists retain their folder context. Check Back across all adopted parts. |
| F6 | 14–16 | Keep the Notebook's applied line as a saved list in a page, using the name in the Library map. |

## Out of scope / later

- The Library search redesign decides where its search lives and what it searches. The Filters panel works with the list it is given. [Search](../search/README.md)
- Reader visibility, Find in the current pane, sorting, paging and choosing something from a short menu keep their own jobs. Review other lists for adoption when their designs are revisited.
- New kinds of marks, a new color grid layout, changes to question discovery, and changes to how files are kept belong to their feature designs.
