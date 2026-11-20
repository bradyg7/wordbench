# The Notebook, with Notion's quality as the template

**State:** exploring (round 3: the review's changes) · **Sheets:** `python -B design/features/notebook/notebook.py` writes `rows/<id>.png` and `rows/index.json`, one frame per row ·
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
| 1 | Any menu (/, block, page ⋯, @, Ctrl+K) | Type while it is open | Rows filter as you type; the first match is highlighted; groups with no match hide; "No results" when none | Nothing | Window only | `menu_filters_as_you_type` | [ ] |
| 2 | Any menu | ↑ ↓, Enter, Esc, or click outside | The highlight moves; Enter picks; Esc or outside closes and focus returns where it was. Nothing on the page moves when it opens | Nothing | Window only | `menu_keys_and_focus_return` | [ ] approved 2026-11-20 |

### Writing, N2 to N4

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 3 | Empty page | Open a new page | The caret is in the title, a faint "Untitled"; Enter moves to the first line, which hints "Press / for blocks" | A new page file | `wb page new "Title"` | `new_page_caret_in_title` | [ ] approved 2026-11-20 |
| 4 | A line | Type `# ` `## ` `### ` `- ` `1. ` `[] ` `> ` `---` | The line turns into heading 1–3, bullet, numbered, to-do, quote or divider at once; Ctrl+Z turns it back to the typed characters | The block's Markdown | `wb block set ID N "## …"` | `markdown_shortcuts_turn_the_line` | [ ] approved 2026-11-20 |
| 5 | A line | Type `**word**`, `*word*`; Ctrl+B, Ctrl+I, Ctrl+U | Bold, italic, underline in place | The Markdown marks (underline as `<u>`) | `wb block set` | `inline_shortcuts_and_keys` | [ ] approved 2026-11-20 |
| 6 | An empty line, or after a space | Type `/` | **One list** at the caret: Text, Heading 1–3, Bullet, Numbered, To-do, Toggle, Quote, Divider, Table, then **Study** folded at its end (Scripture, Word, Callout, Saved thing, List in a page); typing finds any command by name, folded or not ("scr" → Scripture); the same in a narrow pane and a floating tab (6a, 6b) | Nothing until picked | Window only | `slash_menu_one_list_finds_folded` | [ ] |
| 7 | / menu › Scripture | Type a reference | The book completes as you type ("josh" → Joshua, Tab), so names and numbers cannot be wrong; the verse text previews under the field; several verses and ranges across chapters make one block (7a, 7b) | The block's reference | `wb block add ID "Num 25:18-26:1" --after N` | `scripture_block_completes_and_previews` | [ ] |
| 44 | Two Scripture blocks | Drag one by its grip beside the other | They sit side by side to compare; dragging one out stacks them again | The two blocks' column form | `wb block move ID N --beside M`, *proposed* | `scripture_side_by_side` | [ ] |
| 8 | A list item | Enter; Enter on an empty item; Tab; Shift+Tab | A new item; leaves the list; indents; outdents | The items' Markdown and indent | `wb block set` | `list_enter_tab_rules` | [ ] approved 2026-11-20 |
| 9 | A toggle | Click the triangle, or Ctrl+Enter | Its children fold and unfold; a heading can be a toggle too | `<details><summary>…</summary>…</details>` in the page; folded or not is kept in settings/pages.json | `wb block add ID "<details>…"` | `toggle_folds_children` | [ ] |
| 10 | Selected text | Select | A bar above the selection: Turn into ▾, B, I, U, S, link, color ▾, and on scripture text Mark ▾ and Margin note | Nothing until used | Window only | `selection_bar_on_intent` | [ ] |
| 11 | Selection bar | Mark ▾ on scripture in a page | The Legend's styles; the mark lands on those words in the reader too | The mark, as the reader's | `wb mark add …` (existing) | `mark_from_a_page_is_the_reader_s_mark` | [ ] |
| 39 | Scripture in a page | Select words, Mark ▾, pick a style | Step by step (39a–39d): the selection bar, the Legend's styles, the words take the style in the page, and the reader shows the same mark | The mark, as the reader's | `wb mark add …` (existing) | `mark_from_a_page_step_by_step` | [ ] |
| 40 | Scripture in a page | Select words, Margin note | A small box to write in; the note is in that verse's margin and shows in the reader | `margin/<BOOK>/<chapter>.md` | `wb margin add REF "…"` (existing) | `margin_note_from_a_page` | [ ] |
| 12 | A line | `@` then a reference | A menu of verses, pages, folders and Today; a verse is placed as a **link chip** (12a). Clicking the chip opens a popup with the verse (12b) that can be dragged, grown to the whole chapter (12c), or sent to the side reader with Open beside (12d); Esc closes it and Back returns | The reference as a link form (open: its form in the file) | `wb page link ID`; `wb refs` | `at_verse_chip_popup` | [ ] |

### The block handle, N5

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 13 | A block | Hover, or focus it | A + and a grip (⋮⋮) in the left gutter; the text does not shift | Nothing | Window only | `handle_appears_without_shift` | [ ] |
| 41 | A block's gutter | Read what + and the grip do | + adds an empty line below with / open; the grip drags the block, or opens its menu when clicked | Nothing | Window only | `handle_controls_explained` | [ ] |
| 14 | + | Click | A new empty line below, with the / menu open | A new block | `wb block add` | `plus_adds_below_with_menu` | [ ] approved 2026-11-20 |
| 15 | Grip | Drag | A blue line shows where it lands; dropping moves it; dropping to the side makes columns at full width (library S30) | The block's place | `wb block move ID N --to M` | `drag_moves_block` | [ ] approved 2026-11-20 |
| 16 | Grip | Click | The block menu: Turn into ▸, Color ▸, Copy link to block, Duplicate (Ctrl+D), Move to (Ctrl+Shift+P), Delete (Del); at the foot "Edited …" and its word count | Nothing until used | Window only | `block_menu_items_and_foot` | [ ] |
| 17 | Block menu | Turn into ▸ a kind | The block changes kind and keeps its text | The block's Markdown | `wb block set` | `turn_into_keeps_text` | [ ] approved 2026-11-20 |
| 42 | Block menu | Duplicate (Ctrl+D) | A copy right below, with the caret in it | The page | `wb block dup ID N`, *proposed* | `duplicate_block_below` | [ ] |
| 18 | Block menu | Copy link to block | A link that opens this page scrolled to this block. It does not replace scripture references, which stay references and are found by the page index | Clipboard only | `wb block link ID N`, *proposed* | `link_to_block_opens_there` | [ ] |
| 19 | Block menu | Move to | The page chooser; the block leaves this page and is last in the chosen one | Both pages | `wb block move ID N --page OTHER`, *proposed* | `move_block_to_another_page` | [ ] |
| 20 | Block menu | Delete, or Del on a selected block | It goes; "Deleted · Undo" offers the page's Undo | The page | `wb block rm ID N --undo` | `delete_block_with_undo` | [ ] approved 2026-11-20 |
| 21 | Several blocks | Drag across them, or Shift+click; Esc selects the block the caret is in | A pale wash on each; the grip menu acts on all (Turn into, Color, Move to, Delete) | The blocks | `wb block … --count K` | `several_blocks_act_together` | [ ] |
| 43 | The page's margin | Drag from the margin across blocks | A pale selection band follows the pointer; every block it touches is selected | Nothing | Window only | `band_selects_blocks` | [ ] |

### Callouts (questions are one kind), N6

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 22 | / menu (`/callout`) or Turn into | Callout | A soft box with an icon and a kind: Question, Answered, Key point, Note | `> [!question]`, `> [!done]`, `> [!key]`, `> [!note]` | `wb block add ID "> [!key] …"` | `callout_kinds_write_their_marker` | [ ] |
| 23 | A callout's icon | Click | Its kind menu; a Question becomes Answered and back | The marker | `wb block set` | `callout_kind_changes` | [ ] approved 2026-11-20 |
| 24 | Today's pages | Open one with `> [!question]` or `> [!done]` | They show as Question and Answered callouts; the questions list still finds them | Nothing | `wb question list` | `old_question_callouts_still_read` | [ ] approved 2026-11-20 |
| 46 | A callout | Write several lines and a nested list in it | It holds them all (46a); the questions list shows its first line, its page and its kind (46b) | The callout's lines | `wb question list` | `callout_many_lines_and_list` | [ ] |

### Color, N9

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 25 | Selection bar or block menu | Color ▾ | Text or Background, 8 plain colors (Gray, Brown, Orange, Yellow, Green, Blue, Purple, Red) and Default, for emphasis only; text color means nothing (marks carry meaning) | The text in a `<span>`, or the block's marker | `wb block set` | `color_menu_plain_colors` | [ ] |
| 26 | A folder's ⋯ › Color, or New folder | Pick one of the folder colors (as today) | The folder's color is the only organizing color: its pages show the folder's dot by the title and in the side list; nothing is added to any color list | The folder's color | `wb folder color NAME COLOR` | `folder_color_dots_its_pages` | [ ] |

### The page, N7 and N8

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 29 | Top bar | Edit anything | "Edited just now" in quiet gray, later "Edited 2m ago"; no Save button | The page | Window only | `edited_status_updates` | [ ] approved 2026-11-20 |
| 30 | Page ⋯ | Open | Searchable: Copy link, Copy contents, Duplicate, Move to, Page history, Appearance ▸, Lock page, Move to Trash; foot: Edited and word count | Nothing until used | Window only | `page_menu_items` | [ ] |
| 31 | Appearance ▸ | Font Default or Serif; Small text; Full width; Table of contents | The page changes at once | settings/pages.json | `wb page look ID --font serif --toc on` (extends `page look`) | `appearance_changes_at_once` | [ ] |
| 45 | Appearance › Table of contents | Turn on | An outline of the page's headings beside a long page; clicking one scrolls there; ▾ folds it to the edge | settings/pages.json | `wb page look ID --toc on` | `toc_beside_long_page` | [ ] |
| 32 | Lock page | Toggle | Typing does nothing; a quiet lock in the top bar; the handle hides | settings/pages.json | `wb page lock ID on|off`, *proposed* | `locked_page_does_not_edit` | [ ] |
| 33 | Copy contents | Click | The page's Markdown, scripture expanded verbatim from the database | Clipboard only | `wb page text ID`, *proposed* | `copy_contents_expands_scripture` | [ ] approved 2026-11-20 |

### Finding, N10 and N11

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 34 | Anywhere | Ctrl+K | The Library's one search: Recents when empty; results grouped; a live preview of the highlighted result on the right, showing lists, callouts and tables as in the page (34a–34c); Enter opens; Esc returns | Nothing | `wb find WORDS` | `quick_search_preview_and_recents` | [ ] |
| 35 | Side list | Recents | **Recents replaces Today:** a folding group of the last 8 pages opened, newest first, above Pinned, Folders, Pages | Nothing (read from the trail) | `wb history list` | `side_list_recents_replaces_today` | [ ] |
| 36 | / menu | List in a page | Pages that match a line (folder, kind, words), shown as a Table by default, with the view (▾) and the shared Filters button above it | One `view` fence | `wb block add ID` with a `view` fence; `wb page views` | `list_in_a_page_is_a_table` | [ ] |
| 47 | A list in a page | View ▾ | Table, List, Gallery, Board (grouped by folder or callout kind); Calendar and Timeline later; Group by and Sort (47a–47d) | The `view` fence's view | `wb page views`, *proposed* `--view board` | `list_views_table_list_gallery_board` | [ ] |

### Real conditions, N12

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 37 | A page | Floating tab, narrow pane, phone (37a–37c) | The column fits; the handle sits inside the margin; the selection bar wraps; menus become sheets on a phone | Nothing | Window only | `writing_at_every_width` | [ ] |

## What the build must satisfy

- [ ] Every menu is the one menu component (rows 1–2): typing filters, keys work, focus returns, nothing jumps.
- [ ] Writing never waits and never needs a click to continue (rows 3–8).
- [ ] Every text block can turn into every other text kind and keep its text (row 17).
- [ ] Today's pages read and write as before; the files stay Markdown; questions written as callouts stay listed (row 24).
- [ ] Every new core action has its `wb` command (rows marked *proposed*).
- [ ] Desktop, floating, narrow and phone (row 37).
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

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-20 | none | The inventory: adopt, adapt or skip for each Notion line, against round 4 of library | Answered 2026-11-20 (Decisions) |
| 2 | 2026-11-20 | N1–N12, then a frame per row | The first draft: the menu, writing, the block handle, callouts, color, the page, finding, real conditions | Reviewed 2026-11-20 (Directions) |
| 3 | 2026-11-20 | rows/ (60 frames) | The review's changes: one / list, scripture autocomplete and ranges, side by side, Mark and Margin note step by step, the @ chip popup, plain text colors, folder color only, table of contents, callouts with lists, views of a list in a page | Pending |

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
