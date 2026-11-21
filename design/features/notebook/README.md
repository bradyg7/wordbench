# The Notebook, with Notion's quality as the template

**State:** accepted (the person, 2026-11-20, after round 5) · **Sheets:** `python -B design/features/notebook/notebook.py` writes `rows/<id>.png` and `rows/index.json`, one frame per row ·
Nothing here is built. · **Review page:** `node design/review.mjs notebook` writes `review.html`.

The person, 2026-11-20: Notion's quality is the template; Wordbench comes in and changes it for studying the Bible.
Not every Notion command is kept, and Wordbench adds its own Bible-specific versions. This folder is the
[Library map](../../LIBRARY.md)'s Open item 5, "the Notebook's feature inventory": every line is marked **adopt**,
**adapt** or **skip**, with the reason. The redesign's interaction table is built from the adopted and adapted lines.

Sources: the person's 23 screenshots of Notion (2026-11-20, kept outside the repo; named below as N02…N24) and their
written "feel" spec (`notion_feel_spec.md`, summarised here, not copied). Notion's brand, icons and exact visuals are
never copied; its interaction model and proportions are.

## Leading design

One frame per interaction row (the person, 2026-11-20: no whole board). `python -B design/features/notebook/notebook.py`
writes `rows/<id>.png` (1600×1000, ids 1–38, with 12a and 12b) and `rows/index.json`. The round-2 board (N1–N12) is
superseded by these frames and stays in git history (commit 6f78494).

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Every row of the interaction table | `rows/<id>.png` | N1–N12 board (by the row frames) |

## How this fits what is already accepted

The [library](../library/README.md) folder's round 4 (S25–S36, accepted 2026-11-17) already designed "the Notebook
works like Notion": one folding side list (Today only when on, Pinned, Folders, Pages, Margin notes, the Shelf), one
right-click menu, one filter line instead of the Filters form and the Days/Pages/Places/Threads/Questions/All tabs,
a centred page with a title, / and a selection bar, side by side at full width, the page's ⋯, several pages at once.
None of its window work is built. **This inventory does not replace round 4; it raises it to Notion's quality and
fills what round 4 left out** (Turn into, the block handle, markdown shortcuts, toggles, drag to reorder, focus
rules, the feel). Where a line below says "round 4", that part is already decided.

Questions stay a study object: written in a page as a callout and listed by the [questions](../questions/README.md)
folder, not as a Notebook tab.

## Decisions (the person, 2026-11-20)

- **Pause Filters after F2.** F1–F2 stay on `feature/filters`, tested, unmerged. F3 (section independence, Places) is
  not built: those sections go. Filters resumes for surfaces outside the Notebook after this redesign.
- **Notion's quality is the template.** Its feel and interaction model are the starting point; Wordbench changes it
  for Bible study. Inspiration, not a checklist.
- **Round 1 answers (2026-11-20).**
  - L6: page text and block colors have **their own palette**; whether it can be the folders' colors (one palette for
    both) is drawn in round 2 (N9) for the person to choose. The Legend's styles stay for marks.
  - W7: **questions become one kind of callout.** A callout is a block with a kind; Question and Answered are two of
    its kinds, beside Key point and Note. The word for this block is open (round 2 offers names; the Library map
    changes only with the person's go-ahead). `> [!question]` and `> [!done]` in today's pages keep reading as before.
  - P6: **no covers** for now.
  - S2: **the side list gets Recents.**
  - Build order: the feel and writing first, then the page, then the side list.
- **Round 2 answers (2026-11-20).**
  - **Callout** is the word: `/callout` makes one; its kinds are Question, Answered, Key point and Note.
  - **One palette for annotation.** Page and block colors use the same colors as marks and folders, so a color means
    the same everywhere. A person can give a folder a color, or add one new color to the palette, and the pages in
    that folder carry it. No free color picker: customizing must not get in the way of organizing or using the app.
  - **A toggle is written as `<details>`** in the page (the lead's recommendation): other Markdown tools show it folded.
  - **@ for a verse: both forms drawn** (12a plain text, 12b a link chip) to compare before choosing.
  - **One frame per row.** Every row of the table gets its own drawn frame, shown beside the row in a review that moves
    like a presentation (← →), with a comment box per row. The whole board stays as the overview.

## The inventory (round 1)

Each line is a Notion line marked adopt, adapt or skip. Round 2 turns the adopted lines into the interaction table below.

#### The feel

| # | Line | Mark | Why / Wordbench's version |
|---|---|---|---|
| F1 | A calm page that becomes what you need when you type for it; UI out of the way until summoned | adopt | The person's stated goal |
| F2 | Controls appear on intent: + and grip on hover left of a block; bar only on a selection; title buttons only on hover | adopt | Round 4 already does hover-only ⋯/+ in the side list (L-12); extend to blocks |
| F3 | Every menu is searchable and filters as you type; Enter picks, Esc closes; one menu component for /, block menu, page ⋯, quick search | adopt | One component means one feel; also faster to build |
| F4 | No Save button; quiet "Edited just now" | adopt | Pages already save as you type; add the quiet status |
| F5 | Local-first: typing never waits | adopt | Already true (files on disk); keep the typing budget in `npm run measure` |
| F6 | Menus fade in place (~100–150 ms), anchored to the caret or the control; nothing on the page jumps | adopt | "Nothing jumps" is the premium feel |
| F7 | Focus is handled: after / the caret is in the new block; Enter continues a list; Enter on an empty item leaves it; Tab/Shift+Tab indent; new page puts the caret in the title, Enter moves to the body | adopt | Round 4 S29 has Enter; the rest is new |
| F8 | Quiet empty states with a hint ("Press / for blocks"), no illustration | adopt | Teaches without a tutorial; answers "hard to learn" (tester 1) |
| F9 | Small calm chrome around larger comfortable content; consistent density | adopt | |
| F10 | Destructive actions only in menus, always recoverable | adopt | Matches the 7-day Trash and page Undo |

#### Look

| # | Line | Mark | Why / Wordbench's version |
|---|---|---|---|
| L1 | Narrow centred column (~700 px), wide margins; Full width toggle | adopt | Round 4 S28/S30 |
| L2 | Warm off-white canvas, near-black text; warm gray side list; small 13–14 px side text; ~6 px rounded hover | adapt | Through our `tokens.css`, light and dark |
| L3 | Title ~40 px bold, H1 ~30, body 16, line height ~1.5, tight block gaps | adapt | Scripture stays in Literata; the scale in tokens |
| L4 | Page font: Default / Serif / Mono, instant, page-wide | adapt | Default (Inter) and Serif (Literata); skip Mono |
| L5 | Almost monochrome UI; color is for content only; one saturated accent | adopt | Our color already belongs to marks and folders |
| L6 | 10 text colors and 10 pale backgrounds for page text | adapt | **Open:** use the Legend's highlight styles so a page's color means the same as a mark's, or a separate plain palette? |
| L7 | Popovers: soft, large-radius, low-opacity shadows; no hard outlines | adopt | |
| L8 | Every menu row has an icon; shortcuts right-aligned and muted | adopt | |

#### Writing in a page

| # | Line | Mark | Why / Wordbench's version |
|---|---|---|---|
| W1 | Everything is a block; **Turn into** changes a block's kind without losing its text (N10) | adopt | New; round 4 lacks it |
| W2 | Markdown shortcuts as you type: `# ` `## ` `### `, `- `, `1. `, `[] `, `---`, `**b**`, `*i*` | adopt | The files are Markdown already, so the shortcut is the file's own form |
| W3 | `> ` makes a toggle (Notion) | adapt | `> ` makes a quote, as in Markdown; a toggle comes from / or Turn into. `> [!question]` stays the question callout |
| W4 | / menu grouped (Suggested, Basic, …) with shortcut hints (N02–N04) | adopt | Round 4 S29's list, grouped: Basic (text, headings 1–3, lists, to-do, toggle, quote, divider, table, page) and **Study** (scripture, word, question, Saved thing, verse link) |
| W5 | Heading 4 | skip | Three levels are enough for a study page |
| W6 | Toggle list and toggle headings (N05) | adopt | Folding long passages and notes |
| W7 | Callout with an icon (N05) | adapt | The question callout is ours; a plain callout for "key point" is **open** |
| W8 | Code block, equation (N11, N13) | skip | Not Bible study |
| W9 | Selection bar: Turn into, bold, italic, underline, strike, link, color (N06) | adopt | Round 4 S29 has bold, italic, heading, link, highlight; add Turn into, underline, strike, color |
| W10 | Selection bar: inline code, equation, comment, AI actions | skip | Not study; no collaborators; no interpretation (AGENTS rule) |
| W11 | Selection bar: **Mark** (highlight with a Legend style) and **Margin note** on scripture text in a page | adapt | Wordbench's own; the same marks as the reader |
| W12 | Block handle (grip) menu: Turn into, Color, Copy link to block, Duplicate (Ctrl+D), Move to, Delete; last edited and word count at the foot (N07, N08) | adopt | New; "copy link to block" gives a link that opens this page at the block |
| W13 | Block menu: Comment, Suggest edits, Ask AI, Skills | skip | One person's study; no AI interpretation |
| W14 | Drag the grip to reorder blocks | adopt | Finding 64c7 ("dragging blocks does not work yet") |
| W15 | Select several blocks, then move, delete or turn them into one kind | adopt | Not in Notion's screenshots but expected; round 4 has several pages, not several blocks |
| W16 | Columns side by side | adopt | Round 4 S30 |
| W17 | @ mention: date and sub-page (N12) | adapt | @ offers a **verse** (inline reference that opens the reader), a page, a folder, and a date; people skipped |
| W18 | Ctrl+B/I/U, Ctrl+D, Ctrl+Z/Y, Esc, Tab/Shift+Tab on day one | adopt | Ctrl+Shift+M (comment) skipped |

#### The page

| # | Line | Mark | Why / Wordbench's version |
|---|---|---|---|
| P1 | Page ⋯ menu, searchable (N20): copy link, copy contents, duplicate, move to, version history, appearance, lock, move to Trash | adopt | Round 4 S31 is the page's ⋯; add copy contents, lock |
| P2 | Updates & analytics, Use with AI, Suggest edits, Notify me | skip | One person; no AI |
| P3 | Version history | adapt | Round 4's Page history (L-16) |
| P4 | Appearance: font, small text, full width, table of contents (N22, N23) | adopt | Table of contents useful for long lessons |
| P5 | Icon on a page | adopt | Helps find pages in the side list |
| P6 | Cover band and cover gallery (N23, N24) | **open** | Pleasant; images cost space; ask the person |
| P7 | Lock page (read-only) | adopt | Protects finished lessons |

#### Finding and listing

| # | Line | Mark | Why / Wordbench's version |
|---|---|---|---|
| S1 | Ctrl+K quick search: recent pages, filters (in, title only), live preview pane (N21) | adapt | The Library's one search ([search](../search/README.md)) with a preview; Recents first |
| S2 | Side list groups Private / Shared / Recents | adapt | Round 4's groups; **open:** add Recents? |
| S3 | A database as a block with views: table, board, gallery, timeline, filter, sort, group (N14–N19) | adapt | A **list in a page** (Filters rows 14–15's saved list, a `view` fence): table view first; board, gallery, timeline skipped for now |
| S4 | Filter menu (N19) | adapt | The shared Filters panel (F1–F2) is the control a list in a page uses |

#### Removed from the Notebook

| # | Line | Mark | Why |
|---|---|---|---|
| R1 | Days, Places, Questions (and Threads, Inbox, All) as tabs | skip | The person, 2026-11-20: a legacy workflow; round 4 already removed them (S27). Today stays a page you can show; questions are listed by the questions folder; a place is reached from the reader's margin |

## Interaction table

Round 3. Every row has its own frame in `rows/` (steps as a, b, c…); rows marked approved keep their round 2 frame. Rows 27, 28 (page icons) and 38 were removed in round 3. Rows marked *proposed* name a `wb` command that does
not exist yet; it is added with the row. A page is still Markdown with front matter; nothing here changes how the
person's existing pages read.

### The menu (one component for every menu), N1

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 1 | Any menu (/, block, page ⋯, @, Ctrl+K) | Type while it is open | Rows filter as you type; the first match is highlighted; groups with no match hide; "No results" when none | Nothing | Window only | `menu_filters_as_you_type` | built (NB1) · approved 2026-11-20 |
| 2 | Any menu | ↑ ↓, Enter, Esc, or click outside | The highlight moves; Enter picks; Esc or outside closes and focus returns where it was. Nothing on the page moves when it opens | Nothing | Window only | `menu_keys_and_focus_return` | built (NB1) · approved 2026-11-20 |

### Writing, N2 to N4

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 3 | Empty page | Open a new page | The caret is in the title, a faint "Untitled"; Enter moves to the first line, which hints "Press / for blocks" | A new page file | `wb page new "Title"` | `new_page_caret_in_title` | built (NB2) · approved 2026-11-20 |
| 4 | A line | Type `# ` `## ` `### ` `- ` `1. ` `[] ` `> ` `---` | The line turns into heading 1–3, bullet, numbered, to-do, quote or divider at once; Ctrl+Z turns it back to the typed characters | The block's Markdown | `wb block set ID N "## …"` | `markdown_shortcuts_turn_the_line` | [ ] partly (NB2: textarea, not in place) · approved 2026-11-20 |
| 5 | A line | Type `**word**`, `*word*`; Ctrl+B, Ctrl+I, Ctrl+U | Bold, italic, underline in place | The Markdown marks (underline as `<u>`) | `wb block set` | `inline_shortcuts_and_keys` | [ ] partly (NB2: textarea, not in place) · approved 2026-11-20 |
| 6 | An empty line, or after a space | Type `/` | **One list** at the caret: Text, Heading 1–3, Bullet, Numbered, To-do, Toggle, Quote, Divider, Table, then **Study** folded at its end (Scripture, Word, Callout, Saved thing, List in a page); typing finds any command by name, folded or not ("scr" → Scripture); the same in a narrow pane and a floating tab (6a, 6b) | Nothing until picked | Window only | `slash_menu_one_list_finds_folded` | [ ] approved 2026-11-20 |
| 7 | / menu › Scripture | Type a reference | The book completes as you type ("josh" → Joshua, Tab), so names and numbers cannot be wrong; the verse text previews under the field; several verses and ranges across chapters make one block (7a, 7b) | The block's reference | `wb block add ID "Num 25:18-26:1" --after N` | `scripture_block_completes_and_previews` | [ ] approved 2026-11-20 |
| 44 | Scripture blocks | Drag one by its grip beside another | Up to 4 side by side at Full width (44a three, 44b four); fewer columns as the pane narrows, then one under another | The blocks' column form | `wb block move ID N --beside M`, *proposed* | `scripture_side_by_side_up_to_four` | [ ] approved 2026-11-20 |
| 8 | A list item | Enter; Enter on an empty item; Tab; Shift+Tab | A new item; leaves the list; indents; outdents | The items' Markdown and indent | `wb block set` | `list_enter_tab_rules` | [ ] partly (NB2: textarea, not in place) · approved 2026-11-20 |
| 9 | A toggle | Click the triangle, or Ctrl+Enter | Its children fold and unfold; a heading can be a toggle too | `<details><summary>…</summary>…</details>` in the page; folded or not is kept in settings/pages.json | `wb block add ID "<details>…"` | `toggle_folds_children` | [ ] approved 2026-11-20 |
| 10 | Selected text | Select | A bar above the selection: Turn into ▾, B, I, U, S, link, color ▾, and on scripture text Mark ▾ and Margin note | Nothing until used | Window only | `selection_bar_on_intent` | [ ] approved 2026-11-20 |
| 11 | Selection bar | Mark ▾ on scripture in a page | The Legend's styles; the mark lands on those words in the reader too | The mark, as the reader's | `wb mark add …` (existing) | `mark_from_a_page_is_the_reader_s_mark` | [ ] approved 2026-11-20 |
| 39 | Scripture in a page | Select words, Mark ▾, pick a style | Step by step (39a–39d): the bar opens above the selection; Mark ▾'s menu opens attached under the bar; the mark sits on the scripture's own words in the page; the reader shows the same mark | The mark, as the reader's | `wb mark add …` (existing) | `mark_from_a_page_step_by_step` | [ ] approved 2026-11-20 |
| 40 | Scripture in a page | Select words, Margin note | The note opens in the margin beside the selected words, with a grip to drag it; it is that verse's margin note and shows in the reader; a reference in its words ("See 1 Cor 10:8") is found as in a page and shown as the link chip of row 12, which opens the compact chapter panel | `margin/<BOOK>/<chapter>.md` | `wb mark note REF "…"` (existing) | `margin_note_beside_the_words` | [ ] approved 2026-11-20 |
| 12 | A line | `@` then a reference | A menu of verses, pages, folders and Today; a verse is placed as a **link chip** (12a). Clicking the chip opens a popup with the verse (12b) that can be dragged, grown to the whole chapter as a compact panel with a header (reference, ← →, Open in reader, close), sized to its text and snapped to a corner (12c), or sent to the side reader with Open beside (12d); Esc closes it and Back returns | The reference as a link form (open: its form in the file) | `wb page link ID`; `wb refs` | `at_verse_chip_popup` | [ ] approved 2026-11-20 |

### The block handle, N5

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 13 | A block | Hover, or focus it | A + and a grip (⋮⋮) in the left gutter; the text does not shift | Nothing | Window only | `handle_appears_without_shift` | [ ] approved 2026-11-20 |
| 41 | A block's gutter | Read what + and the grip do | + adds an empty line below with / open; the grip drags the block, or opens its menu when clicked | Nothing | Window only | `handle_controls_explained` | [ ] approved 2026-11-20 |
| 14 | + | Click | A new empty line below, with the / menu open | A new block | `wb block add` | `plus_adds_below_with_menu` | [ ] approved 2026-11-20 |
| 15 | Grip | Drag | A blue line shows where it lands; dropping moves it; dropping to the side makes columns at full width (library S30) | The block's place | `wb block move ID N --to M` | `drag_moves_block` | [ ] approved 2026-11-20 |
| 16 | Grip | Click | The block menu: Turn into ▸, Color ▸, Copy link to block, Duplicate (Ctrl+D), Move to (Ctrl+Shift+P), Delete (Del); at the foot "Edited …" and its word count | Nothing until used | Window only | `block_menu_items_and_foot` | [ ] approved 2026-11-20 |
| 17 | Block menu | Turn into ▸ a kind | The block changes kind and keeps its text | The block's Markdown | `wb block set` | `turn_into_keeps_text` | [ ] approved 2026-11-20 |
| 42 | Block menu | Duplicate (Ctrl+D) | A copy right below, with the caret in it | The page | `wb block dup ID N`, *proposed* | `duplicate_block_below` | [ ] approved 2026-11-20 |
| 18 | Block menu | Copy link to block | The whole flow (18a–18c): copy in page A; paste in page B makes a chip "Page A › first words"; clicking it opens page A scrolled to the block, which glows briefly; Back returns. Scripture references stay references (found by the page index) | Page B holds the link | `wb block link ID N`, *proposed* | `link_to_block_flow` | [ ] approved 2026-11-20 |
| 19 | Block menu | Move to | The page chooser; the block leaves this page and is last in the chosen one | Both pages | `wb block move ID N --page OTHER`, *proposed* | `move_block_to_another_page` | [ ] approved 2026-11-20 |
| 20 | Block menu | Delete, or Del on a selected block | It goes; "Deleted · Undo" offers the page's Undo | The page | `wb block rm ID N --undo` | `delete_block_with_undo` | [ ] approved 2026-11-20 |
| 21 | Several blocks | Drag across them, or Shift+click; Esc selects the block the caret is in | A pale wash on each; the grip menu acts on all (Turn into, Color, Move to, Delete) | The blocks | `wb block … --count K` | `several_blocks_act_together` | [ ] approved 2026-11-20 |
| 43 | The page's margin | Drag from the margin across blocks | A pale selection band follows the pointer; every block it touches is selected | Nothing | Window only | `band_selects_blocks` | [ ] approved 2026-11-20 |

### Callouts (questions are one kind), N6

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 22 | / menu (`/callout`) or Turn into | Callout | A soft box with an icon and a kind: Question, Answered, Key point, Note | `> [!question]`, `> [!done]`, `> [!key]`, `> [!note]` | `wb block add ID "> [!key] …"` | `callout_kinds_write_their_marker` | [ ] approved 2026-11-20 |
| 23 | A callout's icon | Click | Its kind menu; a Question becomes Answered and back | The marker | `wb block set` | `callout_kind_changes` | [ ] approved 2026-11-20 |
| 24 | Today's pages | Open one with `> [!question]` or `> [!done]` | They show as Question and Answered callouts; the questions list still finds them | Nothing | `wb question list` | `old_question_callouts_still_read` | [ ] approved 2026-11-20 |
| 46 | A callout | Write several lines and a nested list in it | It holds them all (46a); the Questions list (Library) filters by kind, Question or Answered (46b); Key points and Notes are found by Ctrl+K (46c) and by a List in a page grouped by callout kind (46d) | The callout's lines | `wb question list` | `callout_kinds_found` | [ ] approved 2026-11-20 |

### Color, N9

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 25 | Selection bar or block menu | Color ▾ | Text or Background, 8 plain colors and Default, for emphasis only; text color means nothing (marks carry meaning) (25a); the 8 pale backgrounds on words and on a block (25b) | The text in a `<span>`, or the block's marker | `wb block set` | `color_menu_plain_colors` | [ ] approved 2026-11-20 |
| 26 | A folder's ⋯ › Color, or New folder | Pick one of the folder colors (as today) | The folder's color is the only organizing color: its pages show the folder's dot by the title and in the side list; nothing is added to any color list | The folder's color | `wb folder color NAME COLOR` | `folder_color_dots_its_pages` | [ ] approved 2026-11-20 |

### The page, N7 and N8

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 29 | Top bar | Edit anything | "Edited just now" in quiet gray, later "Edited 2m ago"; no Save button | The page | Window only | `edited_status_updates` | [ ] approved 2026-11-20 |
| 30 | Page ⋯ | Open | Searchable: Copy link, Copy contents, Duplicate, Move to, Page history, Appearance ▸, Lock page, Move to Trash; foot: Edited and word count | Nothing until used | Window only | `page_menu_items` | [ ] approved 2026-11-20 |
| 31 | Appearance ▸ | Font Default or Serif; Small text; Full width; Table of contents | The page changes at once | settings/pages.json | `wb page look ID --font serif --toc on` (extends `page look`) | `appearance_changes_at_once` | [ ] approved 2026-11-20 |
| 45 | Appearance › Table of contents | Turn on | The contents as a bar in the page's right side (45a); a button folds it to a thin rail of ticks and opens it again (45b); it stays inside its own pane among other panes (45c) | settings/pages.json | `wb page look ID --toc on` | `toc_bar_folds_to_rail` | [ ] approved 2026-11-20 |
| 32 | Lock page | Toggle | Typing does nothing; a quiet lock in the top bar; the handle hides | settings/pages.json | `wb page lock ID on|off`, *proposed* | `locked_page_does_not_edit` | [ ] approved 2026-11-20 |
| 33 | Copy contents | Click | The page's Markdown, scripture expanded verbatim from the database | Clipboard only | `wb page text ID`, *proposed* | `copy_contents_expands_scripture` | [ ] approved 2026-11-20 |

### Finding, N10 and N11

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 34 | Anywhere | Ctrl+K | The Library's one search: Recents when empty; results grouped; a live preview of the highlighted result on the right, showing lists, callouts and tables as in the page (34a–34c); folders show with their color and page count (34d); Enter opens; Esc returns | Nothing | `wb find WORDS` | `quick_search_preview_and_recents` | [ ] approved 2026-11-20 |
| 35 | Side list | Recents | **Recents replaces Today:** a folding group of the last 8 pages opened, newest first, above Pinned, Folders, Pages | Nothing (read from the trail) | `wb history list` | `side_list_recents_replaces_today` | [ ] approved 2026-11-20 |
| 36 | / menu | List in a page | A folder acts as the database: each page in it is a row; a column is a page property from its front matter; + New page adds a page to the folder; + Property adds a column; Filters above | One `view` fence; a new page; a property in front matter | `wb block add ID` with a `view` fence; `wb page views`; `wb page prop ID NAME VALUE`, *proposed* | `list_in_a_page_folder_as_database` | [ ] approved 2026-11-20 |
| 48 | / menu | Table | A plain table you type into: + adds a row at the foot or a column at the right; nothing is linked | The table in Markdown | `wb block add ID` with a table | `plain_table_add_row_column` | [ ] approved 2026-11-20 |
| 47 | A list in a page | View ▾, Group by | Table, List, Gallery, Board; Calendar and Timeline later (47a–47d); Group by gathers rows under a heading per folder, callout kind or property, each foldable with its count (47e) | The `view` fence's view and grouping | `wb page views`, *proposed* `--view board --group folder` | `list_views_and_group_by` | [ ] approved 2026-11-20 |

### Real conditions, N12

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 37 | A page | Floating tab, narrow pane, phone (37a–37c) | The column fits; the handle sits inside the margin; the selection bar wraps; menus become sheets on a phone | Nothing | Window only | `writing_at_every_width` | [ ] approved 2026-11-20 |

### Study commands (a brainstorm, in the / menu's Study group)

Each is drawn for the person to keep or cut. Lookups are fetched with `wb`; nothing interprets.

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 49 | / › Study | Scripture | A block that keeps only the reference; the words are read from the database each time | The reference | `wb text REF` | `study_scripture_reference_only` | [ ] approved 2026-11-20 |
| 50 | / › Study | Word | A Strong's entry: the original word, its sound, the definition and the KJV's renderings | The number | `wb strong H7065` | `study_word_block` | [ ] approved 2026-11-20 |
| 51 | / › Study | Interlinear | A verse's original words, each with its sound, gloss and number; a long verse scrolls sideways inside the block, its height grows with its words, and it is as wide as the column (wider at Full width); no drag-to-resize | The reference | `wb interlinear REF` | `study_interlinear_block` | [ ] approved 2026-11-20 |
| 52 | / › Study | Cross references | Proposed: the app has no cross-reference source, so the block says so; a source must be chosen first | The reference | `wb xrefs REF`, *proposed* | `study_cross_references` | [ ] approved 2026-11-20 |
| 53 | / › Study | Concordance | Every place of a word in Bible order, with words either side and the original number | The word | `wb concordance WORD` | `study_concordance_block` | [ ] approved 2026-11-20 |
| 54 | / › Study | Margin notes for a passage | The margin notes on a passage, by verse; each opens its note | The passage | `wb mark notes REF` | `study_margin_notes_block` | [ ] approved 2026-11-20 |
| 55 | / › Study | Marks in a passage | Every mark on a passage with its Legend style and the marked words | The passage | `wb marks BOOK CH` | `study_marks_block` | [ ] approved 2026-11-20 |

## Tickets (cut 2026-11-20, built in this order, one at a time)

A ticket is done when every row in it has its passing test and its Built cell says built.

| Ticket | Rows | What |
|---|---|---|
| NB1 | 1, 2 | The one menu component: filter as you type, keys, Esc, focus returns |
| NB2 | 3, 4, 5, 8 | The new page editor: title, Markdown shortcuts, bold/italic/underline, lists |
| NB2b | 4, 5, 8 (and every later row) | The in-place editor: each block is its own contenteditable, styled as you type; Markdown stays the file form (`<u>` for underline); the textarea editor is removed (decided 2026-11-21) |
| NB3 | 6, 7, 49 | The / menu (one list, Study folded) and the Scripture block with book autocomplete |
| NB4 | 9, 10, 25 | Toggles, the selection bar, Color ▾ (text and background) |
| NB5 | 12 | `@`: the link chip and the compact chapter panel |
| NB6 | 13, 41, 14, 16, 17, 42, 20 | The block handle: +, grip menu, Turn into, Duplicate, Delete with Undo |
| NB7 | 15, 44, 21, 43 | Dragging blocks, columns up to 4, selecting several blocks |
| NB8 | 11, 39, 40 | Mark ▾ on scripture in a page, Margin note beside the words |
| NB9 | 18, 19 | Copy link to block, Move to |
| NB10 | 22, 23, 24, 46 | Callouts, their kinds, the questions already written read as callouts |
| NB11 | 29, 30, 31, 32, 33, 45 | The page: Edited time, page ⋯, Appearance, Lock, Copy contents, contents bar |
| NB12 | 50–55 | The other Study blocks |
| NB13 | 34, 35, 26 | Ctrl+K, Recents, folder color |
| NB14 | 36, 48, 47 | List in a page, Table, views and Group by |
| NB15 | 37 and the checks below | Floating, narrow, phone; the 400-block budget; old page code removed |

## What the build must satisfy

- [x] Every menu is the one menu component (rows 1–2): typing filters, keys work, focus returns, nothing jumps.
- [ ] Writing never waits and never needs a click to continue (rows 3–8).
- [ ] Every text block can turn into every other text kind and keep its text (row 17).
- [ ] Today's pages read and write as before; the files stay Markdown; questions written as callouts stay listed (row 24).
- [ ] Every new core action has its `wb` command (rows marked *proposed*).
- [ ] Desktop, floating, narrow and phone (row 37).
- [ ] The floating pane drags smoothly (row 6; checked in the build).
- [ ] The interlinear block (row 51) scrolls sideways inside itself when a verse is long, grows in height with its words, and is as wide as the column (wider at Full width); it has no drag-to-resize.
- [ ] A page of 400 blocks types, opens menus and drags inside the typing budget of `npm run measure`; nothing jumps (was row 38).
- [ ] The page is rebuilt on this design; the old page code and its ways are taken out, not built around.

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25.json` | `wb text Num 25:11-13` |
| `data/ps106.json` | `wb text Ps 106:30-31` |
| `data/josh1.json` | `wb text Josh 1:9` |
| `data/num25_26.json` | `wb text Num 25:18-26:1` |
| `data/ps106ch.json` | `wb text Ps 106:28-33` |
| `data/num25_11_13.json` | `wb text Num 25:11-13` |
| `data/num25_9.json` | `wb text Num 25:9` |
| `data/1cor10_8.json` | `wb text 1 Cor 10:8` |
| `data/strong_h7065.json` | `wb strong H7065` |
| `data/interlinear_num25_11.json` | `wb interlinear Num 25:11` |
| `data/concordance_zealous.json` | `wb concordance zealous` |

Scripture is fetched from the database, never typed. Page titles, folder names, notes and counts are a drawn sample,
not anyone's study.

## The real conditions

| Condition | Window |
|---|---|
| Among other tabs | round 2 board N12 (git 6f78494) |
| Floating | rows/37a, rows/6b |
| Narrow | rows/37b, rows/37c, rows/6b |
| Years of study | N11 (round 4's side list counts: 75 pages, 5 folders, 86 margin notes); a 400-block page is a check under What the build must satisfy |

## Open questions

- **@ chip in the file:** what form the chip takes in the Markdown (a link around the reference, or a marker), so other
  tools still show the reference and the page index still finds it.
- **Two Scripture blocks side by side (44):** the form in the file for a pair of columns.
- **Fonts (row 31):** which reading serif already shipped joins Default and Serif; no font downloads.
- **Board view (47d):** dragging a card to another folder's column moves the page; is that wanted, or is a board only
  for reading?
- **Nesting and the Shelf:** folders in folders, pages in pages, how a nested page shows its folder's color, references
  to pages, and the Shelf move to their own design in the [library](../library/README.md) folder (proposed next). Row 26
  stays as drawn until then.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-20 | none | The inventory: adopt, adapt or skip for each Notion line, against round 4 of library | Answered 2026-11-20 (Decisions) |
| 2 | 2026-11-20 | N1–N12, then a frame per row | The first draft: the menu, writing, the block handle, callouts, color, the page, finding, real conditions | Reviewed 2026-11-20 (Directions) |
| 3 | 2026-11-20 | rows/ (60 frames) | The review's changes: one / list, scripture autocomplete and ranges, side by side, Mark and Margin note step by step, the @ chip popup, plain text colors, folder color only, table of contents, callouts with lists, views of a list in a page | Reviewed 2026-11-20 (Directions) |

| 4 | 2026-11-20 | rows/ (78 frames) | The round 3 review: Mark on the words, the chapter panel, the link flow, contents as a bar, Table and List in a page, Group by, four side by side, margin note beside the words, backgrounds, callout kinds found, folders in Ctrl+K, and Study commands (49–55) | Reviewed 2026-11-20 (Directions) |
| 5 | 2026-11-20 | rows/40 | Row 40: a reference in a margin note is a link chip opening the chapter panel | Pending |

## Directions

### Round 2 review (the person, 2026-11-20; review-notebook-round2.json)

Tally: 20 Perfect, 13 Satisfactory, 2 Not great (+1 Not great row 6), 2 Horrible, 1 unrated. Worst first, each with
what round 3 does.

| Row | Rating | Reasons | Round 3 |
|---|---|---|---|
| 27, 28 | Horrible | Not needed | **Removed.** No page icons, no "Add icon" on the title. |
| 25 | Not great | Too busy, missing state, surprising, unclear label, frame unclear, needs before/after | **Decided by the lead (see below): text color carries no meaning.** One small set of plain text and background colors in the app's hues, for emphasis only; the Legend's colors stay the only colors that mean something (marks). Redraw: before/after, a short menu (8 colors, Default), no "palette" word. |
| 26 | Not great | (comment: what does a palette mean; pages with their own colors get disorganized) | **A folder's color is the only organizing color.** A page shows its folder's dot; nothing else colors a page by meaning. No "add a color to the palette"; a folder picks from the same folder colors as today. Redraw before/after. |
| 6 | Not great | Surprising, frame unclear | **One list.** The / menu is one list; Study is a folded group at its end; typing finds every command by name (e.g. "scr" shows Scripture). Draw it in a narrow and floating pane too. |
| 11 | Satisfactory | Missing state, too many steps | Draw every step: select scripture → Mark ▾ → pick a style → the mark shows in the page and in the reader. |
| 12 | Satisfactory | 12b chosen | **The link chip (12b).** Clicking it opens a popup with the verse(s); the popup can be dragged, can grow to the whole chapter, or send the passage to the side reader. Draw: chip, popup, popup grown, side reader. |
| 7 | Satisfactory | | Scripture block: as you type a book, autocomplete ("josh" → Joshua) so spelling and numbers cannot be wrong; the verse text previews under the field; several verses and ranges across chapters; scripture blocks can be dragged side by side to compare. |
| 9 | Perfect | | A **table of contents** that folds, beside a long page (like a document outline), drawn with Appearance › Table of contents (row 31). |
| 10, 13, 16 | Perfect | | Add rows for what each control and menu item does: Mark, Margin note, + and grip explained, Duplicate, Copy link to block, Move to (each its own frame). |
| 18 | Satisfactory | | Answer: a link to a block is a link to a place in a page; it does not replace scripture references, which stay references (found by the page index). Caption says so. |
| 21 | Satisfactory | | Draw the drag to select several blocks (the selection band). |
| 22 | Satisfactory | "something feels incomplete" | Draw a callout with more than one line, a nested list inside it, and how it looks in the questions list. |
| 34 | Satisfactory | | The preview shows other kinds: a page with a list, a callout, a table. |
| 35 | Perfect | | **Recents replaces Today** in the side list. |
| 36 | Satisfactory | | List in a page gets views, from the person's Notion views screenshots: Table, List, Gallery, Board (by folder or callout kind); Calendar and Timeline later. Draw the layout menu and each kept view. These also feed the Library's view of folders. |
| 37 | Satisfactory | Cramped | Redraw the narrow and phone frames with room. |
| 38 | Satisfactory | | **Not a frame.** A page of many blocks becomes a check under What the build must satisfy. |
| 31 | Perfect | | More fonts only if light: offer Default, Serif and one reading serif already shipped; no font downloads. |
| 30 | Perfect | | Build note: the page is rebuilt on this design; the old page code and its ways are taken out, not built around. The same holds later for tabs, commands, and the Notes & lookup pane. |

### Approved for building (Perfect with no change asked)

Rows 2, 3, 4, 5, 8, 14, 15, 17, 20, 23, 24, 29, 33. They leave the review; the next rounds show only rows that still
need review. (1, 9, 10, 13, 16, 30, 31, 35 were Perfect or Satisfactory with something asked; they stay.)

### Round 3 review (the person, 2026-11-20; review-notebook-round3.json)

Tally: 23 Perfect, 7 Satisfactory, 0 Not great, 0 Horrible. Worst first, then Perfect rows that asked something.

| Row | Rating | Asked | Round 4 |
|---|---|---|---|
| 39 | Satisfactory | Bar connected to its menu; marks on the words, not below | Redraw: the Mark ▾ menu opens attached under the selection bar; the mark is drawn on the scripture's own words in the page, as the app draws it. |
| 12 | Satisfactory | Chapter box draggable to a corner, no wasted space, more structured | Redraw 12c: a compact panel with a header (reference, ← → chapter, Open in reader, close), snaps to a corner, sized to its text. |
| 18 | Satisfactory | How do links work? | Draw the whole flow: Copy link to block in page A → paste in page B makes a chip "Page A › first words" → clicking opens page A scrolled to that block, which glows briefly; Back returns. You choose where it goes by copying from that block. |
| 26 | Satisfactory | Nested folders and pages, page references | **Moved to its own design: nesting** (folders in folders, pages in pages, how a page's folder color shows when nested, what a reference to a page looks like). It belongs to the [library](../library/README.md) folder's side list; proposed as the next folder after this one. Row 26 stays as drawn until then. |
| 45 | Satisfactory | A full bar, or minimize into the page's side | Redraw: the contents sit in the page's right side as a bar; a button folds it to a thin rail of ticks and opens it again; it stays inside its own pane when other panes are open. |
| 36 | Satisfactory | Own entries, add rows and columns; database or folder? | **Lead's recommendation:** two blocks. A **Table** is a plain table you type into (add a row, add a column, like Notion's simple table). A **List in a page** shows pages: a folder acts as the database, each page is a row, and a column is a page property kept in the page's front matter; "+ New" adds a page to that folder, "+ Property" adds a column. Draw both. |
| 47 | Satisfactory | What does group by mean | Draw Group by: rows gathered under headings by a property (folder, callout kind, a property), each heading foldable with a count. |
| 44 | Perfect | 3 or 4 side by side? | Yes: up to 4 at Full width; fewer columns as the pane narrows; draw 3 and 4. |
| 40 | Perfect | Margin note button near the scripture, draggable | Redraw: Margin note opens beside the selected words in the margin, and the note can be dragged. |
| 25 | Perfect | What does a background look like | Add a frame: the 8 pale backgrounds on a line and on a block. |
| 46 | Perfect | Where are the question, answered, key point and note lists | Draw: the Questions list (Library) filters by kind: Question, Answered; Key point and Note are found by Ctrl+K and by a List in a page grouped by callout kind. |
| 34 | Perfect | How are folders searched; other study commands | Folders show in Ctrl+K results with their color and page count (draw). **New group: Study commands** (brainstorm row by row): Scripture, Word (a Strong's entry), Interlinear (a verse's original words), Cross references for a verse, Concordance list, Margin notes for a passage, Marks in a passage. Each gets its own frame; the person keeps or cuts each. |
| 35 | Perfect | What is the Shelf | **Its own design** with nesting (the library folder): what the Shelf is today, whether it stays. |
| 6 | Perfect | Dragging the floating pane | Build note: the floating pane drags smoothly (checked in the build). |
| 1, 37 | Perfect | (1: the right panel is only the "No results" example; 37: the tab could lead the tabs redesign) | Approved. 37's tab is noted for the tabs redesign. |

### Approved for building (round 3)

Rows 1, 6, 7, 9, 10, 11, 13, 16, 19, 21, 22, 30, 31, 32, 37, 41, 42, 43. With round 2's 13, that is 31 of 44.

### Next designs this review opened

- **Nesting and the Shelf** (library): folders in folders, pages in pages, references to pages, the Shelf.
- **Tabs** (37's floating tab as the starting look).

### Round 4 review (the person, 2026-11-20)

Tally: 20 Perfect, 1 unrated (row 40, a question). Two questions answered:

- **Row 51, is the interlinear scrollable, can its size change?** It scrolls sideways inside its block when a verse is
  long, its height grows with its words, and it is as wide as the column (wider at Full width); no drag-to-resize.
- **Row 40, do margin notes give clickable references?** Yes: wb-core's margin notes already find references in a
  note's own words (`find_refs`). Round 5 redraws 40: "See 1 Cor 10:8" in the note is the link chip of row 12 and
  opens the same compact chapter panel.

### Approved (round 4)

Rows 12, 18, 25, 26, 32, 34, 35, 36, 39, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55.

### Round 5 review (the person, 2026-11-20; review-notebook-round5.json)

Rows 40 and 32: Perfect. Every row is approved; the person accepted the design on 2026-11-20. Next: tickets in the order menu and writing, the page, the side list.
