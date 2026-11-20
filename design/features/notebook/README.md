# The Notebook, with Notion's quality as the template

**State:** exploring (round 2: the first draft) · **Sheets:** `python -B design/features/notebook/notebook.py` writes `notebook.figcraft` and `notebook.pdf` (N1–N12) ·
Nothing here is built. · **Review page:** `node design/review.mjs notebook` writes `review.html`.

The person, 2026-11-20: Notion's quality is the template; Wordbench comes in and changes it for studying the Bible.
Not every Notion command is kept, and Wordbench adds its own Bible-specific versions. This folder is the
[Library map](../../LIBRARY.md)'s Open item 5, "the Notebook's feature inventory": every line is marked **adopt**,
**adapt** or **skip**, with the reason. The redesign's interaction table is built from the adopted and adapted lines.

Sources: the person's 23 screenshots of Notion (2026-11-20, kept outside the repo; named below as N02…N24) and their
written "feel" spec (`notion_feel_spec.md`, summarised here, not copied). Notion's brand, icons and exact visuals are
never copied; its interaction model and proportions are.

## Leading design

The windows the board (and its PDF) holds, by part. Nothing is superseded yet.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| The one menu component | N1 | |
| A new page | N2 | |
| The / menu | N3 | |
| The selection bar and @ | N4 | |
| The block handle, block menu, drag, several blocks | N5 | |
| Callouts (and the three names offered) | N6 | |
| The page: icon, Add icon, toggles | N7 | |
| The page's three dots and Appearance | N8 | |
| Color: own palette or folder colors | N9 | |
| Ctrl+K quick search | N10 | |
| Recents in the side list; a list in a page | N11 | |
| Real conditions (floating, narrow, phone, among tabs) | N12 | |

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

Round 2, the first draft. Every row is drawn on a sheet (N1–N12). Rows marked *proposed* name a `wb` command that does
not exist yet; it is added with the row. A page is still Markdown with front matter; nothing here changes how the
person's existing pages read.

### The menu (one component for every menu), N1

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 1 | Any menu (/, block, page ⋯, @, Ctrl+K) | Type while it is open | Rows filter as you type; the first match is highlighted; groups with no match hide; "No results" when none | Nothing | Window only | `menu_filters_as_you_type` | [ ] |
| 2 | Any menu | ↑ ↓, Enter, Esc, or click outside | The highlight moves; Enter picks; Esc or outside closes and focus returns where it was. Nothing on the page moves when it opens | Nothing | Window only | `menu_keys_and_focus_return` | [ ] |

### Writing, N2 to N4

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 3 | Empty page | Open a new page | The caret is in the title, a faint "Untitled"; Enter moves to the first line, which hints "Press / for blocks" | A new page file | `wb page new "Title"` | `new_page_caret_in_title` | [ ] |
| 4 | A line | Type `# ` `## ` `### ` `- ` `1. ` `[] ` `> ` `---` | The line turns into heading 1–3, bullet, numbered, to-do, quote or divider at once; Ctrl+Z turns it back to the typed characters | The block's Markdown | `wb block set ID N "## …"` | `markdown_shortcuts_turn_the_line` | [ ] |
| 5 | A line | Type `**word**`, `*word*`; Ctrl+B, Ctrl+I, Ctrl+U | Bold, italic, underline in place | The Markdown marks (underline as `<u>`) | `wb block set` | `inline_shortcuts_and_keys` | [ ] |
| 6 | An empty line, or after a space | Type `/` | The block menu at the caret, grouped **Basic** (text, heading 1–3, bullet, numbered, to-do, toggle, quote, divider, table, page) and **Study** (scripture, word, callout, Saved thing, list in a page); shortcut hints on the right | Nothing until picked | Window only | `slash_menu_groups_and_hints` | [ ] |
| 7 | / menu | Pick a block | The block appears and the caret is inside it ready to type (scripture: the reference field) | The block | `wb block add ID "…" --after N` | `slash_pick_puts_caret_inside` | [ ] |
| 8 | A list item | Enter; Enter on an empty item; Tab; Shift+Tab | A new item; leaves the list; indents; outdents | The items' Markdown and indent | `wb block set` | `list_enter_tab_rules` | [ ] |
| 9 | A toggle | Click the triangle, or Ctrl+Enter | Its children fold and unfold; a heading can be a toggle too | `<details><summary>…</summary>…</details>` in the page; folded or not is kept in settings/pages.json | `wb block add ID "<details>…"` | `toggle_folds_children` | [ ] |
| 10 | Selected text | Select | A bar above the selection: Turn into ▾, B, I, U, S, link, color ▾, and on scripture text Mark ▾ and Margin note | Nothing until used | Window only | `selection_bar_on_intent` | [ ] |
| 11 | Selection bar | Mark ▾ on scripture in a page | The Legend's styles; the mark lands on those words in the reader too | The mark, as the reader's | `wb mark add …` (existing) | `mark_from_a_page_is_the_reader_s_mark` | [ ] |
| 12 | A line | `@` then type | A menu of verses (as you type a reference), pages, folders and Today. **Two forms drawn to compare (12a, 12b):** 12a the verse stays plain text, quietly underlined, found by the page index; 12b a link chip with the reference. Clicking either opens the reader at it and Back returns | 12a: the reference as text; 12b: a link form (open) | `wb page link ID`; `wb refs` | `at_mention_verse_page_folder` | [ ] |

### The block handle, N5

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 13 | A block | Hover, or focus it | A + and a grip (⋮⋮) in the left gutter; the text does not shift | Nothing | Window only | `handle_appears_without_shift` | [ ] |
| 14 | + | Click | A new empty line below, with the / menu open | A new block | `wb block add` | `plus_adds_below_with_menu` | [ ] |
| 15 | Grip | Drag | A blue line shows where it lands; dropping moves it; dropping to the side makes columns at full width (library S30) | The block's place | `wb block move ID N --to M` | `drag_moves_block` | [ ] |
| 16 | Grip | Click | The block menu: Turn into ▸, Color ▸, Copy link to block, Duplicate (Ctrl+D), Move to (Ctrl+Shift+P), Delete (Del); at the foot "Edited …" and its word count | Nothing until used | Window only | `block_menu_items_and_foot` | [ ] |
| 17 | Block menu | Turn into ▸ a kind | The block changes kind and keeps its text | The block's Markdown | `wb block set` | `turn_into_keeps_text` | [ ] |
| 18 | Block menu | Copy link to block | A link that opens this page scrolled to this block | Clipboard only | `wb block link ID N`, *proposed* | `link_to_block_opens_there` | [ ] |
| 19 | Block menu | Move to | The page chooser; the block leaves this page and is last in the chosen one | Both pages | `wb block move ID N --page OTHER`, *proposed* | `move_block_to_another_page` | [ ] |
| 20 | Block menu | Delete, or Del on a selected block | It goes; "Deleted · Undo" offers the page's Undo | The page | `wb block rm ID N --undo` | `delete_block_with_undo` | [ ] |
| 21 | Several blocks | Drag across them, or Shift+click; Esc selects the block the caret is in | A pale wash on each; the grip menu acts on all (Turn into, Color, Move to, Delete) | The blocks | `wb block … --count K` | `several_blocks_act_together` | [ ] |

### Callouts (questions are one kind), N6

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 22 | / menu (`/callout`) or Turn into | Callout | A soft box with an icon and a kind: Question, Answered, Key point, Note | `> [!question]`, `> [!done]`, `> [!key]`, `> [!note]` | `wb block add ID "> [!key] …"` | `callout_kinds_write_their_marker` | [ ] |
| 23 | A callout's icon | Click | Its kind menu; a Question becomes Answered and back | The marker | `wb block set` | `callout_kind_changes` | [ ] |
| 24 | Today's pages | Open one with `> [!question]` or `> [!done]` | They show as Question and Answered callouts; the questions list still finds them | Nothing | `wb question list` | `old_question_callouts_still_read` | [ ] |

### Color, N9

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 25 | Selection bar or block menu | Color ▸ | The app's one annotation palette (the same colors as marks and folders), plus Default; no free color picker | The text in a `<span>`, or the block's marker | `wb block set` | `color_palette_is_the_annotation_palette` | [ ] |
| 26 | A folder's ⋯ › Color, or New folder | Pick a color from the same palette, or add one new color to the palette | Pages in that folder show the folder's color (a dot by the title and in the side list); a page's own text colors stay as written | The folder's color | `wb folder color NAME COLOR` (existing folder colors; *proposed* for adding a palette color) | `folder_color_tints_its_pages` | [ ] |

### The page, N7 and N8

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 27 | Title | Hover | "Add icon" above the title (no cover) | Nothing | Window only | `title_hover_shows_add_icon` | [ ] |
| 28 | Add icon | Pick an emoji or a line icon | It sits before the title and in the side list | The page's front matter `icon:` | `wb page icon ID 📖`, *proposed* | `page_icon_in_title_and_side_list` | [ ] |
| 29 | Top bar | Edit anything | "Edited just now" in quiet gray, later "Edited 2m ago"; no Save button | The page | Window only | `edited_status_updates` | [ ] |
| 30 | Page ⋯ | Open | Searchable: Copy link, Copy contents, Duplicate, Move to, Page history, Appearance ▸, Lock page, Move to Trash; foot: Edited and word count | Nothing until used | Window only | `page_menu_items` | [ ] |
| 31 | Appearance ▸ | Font Default or Serif; Small text; Full width; Table of contents | The page changes at once | settings/pages.json | `wb page look ID --font serif --toc on` (extends `page look`) | `appearance_changes_at_once` | [ ] |
| 32 | Lock page | Toggle | Typing does nothing; a quiet lock in the top bar; the handle hides | settings/pages.json | `wb page lock ID on|off`, *proposed* | `locked_page_does_not_edit` | [ ] |
| 33 | Copy contents | Click | The page's Markdown, scripture expanded verbatim from the database | Clipboard only | `wb page text ID`, *proposed* | `copy_contents_expands_scripture` | [ ] |

### Finding, N10 and N11

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 34 | Anywhere | Ctrl+K | The Library's one search: Recents when empty; results grouped; a live preview of the highlighted result on the right; Enter opens; Esc returns | Nothing | `wb find WORDS` | `quick_search_preview_and_recents` | [ ] |
| 35 | Side list | Recents | A folding group of the last 8 pages opened, newest first | Nothing (read from the trail) | `wb history list` | `side_list_recents` | [ ] |
| 36 | / menu | List in a page | A table of pages that match a line (folder, kind, words), with the shared Filters panel above it | One `view` fence | `wb block add ID` with a `view` fence; `wb page views` | `list_in_a_page_is_a_table` | [ ] |

### Real conditions, N12

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Proposed test | Built |
|---|---|---|---|---|---|---|---|
| 37 | A page | Floating tab, narrow pane, phone | The column fits; the handle sits inside the margin; the selection bar wraps; menus become sheets on a phone | Nothing | Window only | `writing_at_every_width` | [ ] |
| 38 | A page of 400 blocks | Type, open menus, drag | Inside the typing budget of `npm run measure`; nothing jumps | Nothing | Window only | `big_page_stays_inside_budget` | [ ] |

## What the build must satisfy

- [ ] Every menu is the one menu component (rows 1–2): typing filters, keys work, focus returns, nothing jumps.
- [ ] Writing never waits and never needs a click to continue (rows 3–8).
- [ ] Every text block can turn into every other text kind and keep its text (row 17).
- [ ] Today's pages read and write as before; the files stay Markdown; questions written as callouts stay listed (row 24).
- [ ] Every new core action has its `wb` command (rows marked *proposed*).
- [ ] Desktop, floating, narrow and phone (row 37); a 400-block page inside the budget (row 38).

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25.json` | `wb text Num 25:11-13` |
| `data/ps106.json` | `wb text Ps 106:30-31` |

Scripture is fetched from the database, never typed. Page titles, folder names, notes and counts are a drawn sample,
not anyone's study.

## The real conditions

| Condition | Window |
|---|---|
| Among other tabs | N12 · Among other tabs |
| Floating | N12 · Floating tab |
| Narrow | N12 · Narrow pane beside the reader; N12 · Phone: menus as sheets |
| Years of study | N11 (round 4's side list counts: 75 pages, 5 folders, 86 margin notes); a 400-block page is row 38, not drawn |

## Open questions

- **@ for a verse:** 12a or 12b, after seeing both.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-20 | none | The inventory: adopt, adapt or skip for each Notion line, against round 4 of library | Answered 2026-11-20 (Decisions) |
| 2 | 2026-11-20 | N1–N12 | The first draft: the menu, writing, the block handle, callouts, color, the page, finding, real conditions | Pending |

## Directions

### Recommendation

Adopt the feel (F1–F10) and writing (W) lines whole: they are what makes Notion feel like Notion, and round 4 does
not have them. Then round 2 draws them on top of round 4's accepted windows (S28 page, S29 writing, S31 ⋯), so the
interaction table has one row per key, menu item and shortcut. Build order: one menu component (F3), then writing
(W1–W4, W9, W12, W14), then the page (P), then the side list (round 4 S25).
