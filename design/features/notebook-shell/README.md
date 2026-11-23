# The Notebook's shell, like Notion

> **Read [the principles](../principles/README.md) first** (2026-11-22): it says which of this folder's decisions stand under the new frame (desks, bubbles, the dock) and lists any that conflict, for the person to settle.

**State:** accepted (the person, 2026-11-22, round 1: "i like it") · **Sheets:** `node design/features/notebook-shell/frames.mjs` writes
`rows/<id>.png` and `rows/index.json` from `frames.html` · Nothing here is built. · **Review page:**
`node design/review.mjs notebook-shell` writes `review.html`.

The person, 2026-11-22, after installing 0.3.0: the Notebook still squeezes pages into cards under
Days / Pages / Places / Questions tabs, "No place yet" chips, places and threads that the designs removed, a Trash you
cannot leave, New page that does not open where you are, lock and undo that do nothing, and "Write, or type / for a
block" stacked down the page. "I really think most of the old code for the notebook is still here." Notion's quality is
the template ([notebook](../notebook/README.md), accepted 2026-11-20).

This folder designs **the shell around the page**: the side list and page tree, the list of pages, opening a page and
where it opens, deleting and the Trash, the menus, and the list in a page as a database. The page itself (writing,
blocks, /, callouts, Appearance) stays as the [notebook](../notebook/README.md) folder designed it. The side list,
right-click menu and one filter line were already accepted in [library](../library/README.md) round 4 (S25–S32,
2026-11-17) but **never built**; this round redraws them at Notion's quality, adds what round 4 left out (the page
tree, where a page opens, the Trash), and says which old code goes.

## Why the bugs come from the shell (an audit of 0.3.0, read-only)

The overhaul built a new page editor inside the **old Notebook pane** (`ui/src/notebook.ts`, about 2,800 lines from
before the redesign). The old pane still decides what the list is (`wb-core notebook::list`: days, placed notes, the
Inbox, threads, questions), how a page opens, the Trash view and the old Delete All form. So:

| What the person found | Where it comes from |
|---|---|
| Cards, Days / Pages / Places / Questions tabs, "No place yet" | the old list (`notebook::list`, `placed`, `group`), not the side list of S25 |
| Places and threads still there (f_…232828) | the old list's groups and `threadPlaces` |
| Trash cannot be left | the Trash is drawn into the old list's body with no way back to the list state |
| New page does not show in the same pane | the old pane opens a page in a dock tab of its own; with several panes the new tab is hidden behind another |
| Lock does nothing (f_…232700) | the lock is wired to the new editor; the old pane redraws the page through its own path |
| Ctrl+Z / Ctrl+Y (f_…232744) | the old pane's keys and the command box take the keys before the editor |
| The Notebook "erased" | not a bug of the shell: the installed app opened `Documents\wordbench-study-data`, another study folder (3 pages); the person's 30 pages are untouched in `bible-study-data` |

**Proposal:** build the shell new, as its own module, and remove the old pane, its list and its Trash view in the same
ticket that replaces each (row 40). Fixing the bugs one by one inside the old pane would keep the old design alive.

## Notion: the reference (descriptions, 2026-11-22)

Notion's interaction model and proportions, never its brand, icons or exact visuals. The person's 23 screenshots of
2026-11-20 (N02–N24, in the [notebook](../notebook/README.md) folder) cover the page, menus and databases; these lines
add the shell. Each is marked **adopt**, **adapt** or **skip**.

| # | Notion | Mark | Wordbench's version |
|---|---|---|---|
| R1 | **Sidebar**: one narrow column (about 240 px, resizable, collapses with Ctrl+\\ or ‹‹). Top: workspace name, Search, Home, Inbox. Then sections (Favorites, Teamspaces, Private) each folding by its heading. Bottom: Settings, Templates, Trash | adapt | One side list: Search, then Recents, Pinned, Folders, Pages; foot: Templates, Trash. No Home, no Inbox, no teamspaces (one person) |
| R2 | **Page tree**: every page is a row with an icon and title; a ▸ disclosure on hover opens its child pages, nested as deep as wanted; an empty page says "No pages inside" | adopt | Pages inside pages (already in `pages`) shown as a tree; a folder is a tree row with its color dot |
| R3 | **Row hover**: ⋯ and + appear at the row's right only on hover; ⋯ is the page menu, + makes a page inside | adopt | As L-12 (round 4) |
| R4 | **Drag a row** to reorder or to drop it inside another page (a blue line between, a blue box on) | adopt | Order kept in `settings/pages.json`; inside = parent |
| R5 | **New page** (the pen at the top, or + on a section): a blank page opens at once **in the main view, replacing what was there**, title focused, "Untitled" placeholder; it appears in the tree immediately | adopt | The fix for "New page does not load in the same pane" |
| R6 | **Opening a page**: a click opens it in the main view; Ctrl+click opens a new tab (desktop app); a page opened from a database opens as a **side peek**, a **center peek** or full page (a per-database choice); breadcrumbs at the top show the path | adapt | Click opens in place; Ctrl+click beside; from a list in a page: side peek (row 14). Breadcrumb path at the top (S28) |
| R7 | **Back / forward** arrows and Alt+← / Alt+→ walk the pages opened | adopt | The trail (Library map: trail = back/forward) |
| R8 | **Delete**: ⋯ › Delete (Move to Trash) removes the page and its children; a toast "Moved to Trash · Undo"; the page, if open, shows a red band "This page is in Trash" with Restore and Delete permanently | adopt | Trash TR-2/TR-3 (accepted): toast with Undo; the band when the open page is in the Trash |
| R9 | **Trash**: a popover from the sidebar foot, not a page: a search box, filters (Last edited by, In, Teamspace), a list of trashed pages each with ↺ Restore and 🗑 Delete; click a row to open it read-only; Esc or a click outside closes it and leaves you where you were | adopt | Fixes "cannot leave the Trash": it is a popover over the side list, closed by Esc or a click outside; the 7-day erase and Erase now stay as decided (2026-11-03, 2026-11-04) |
| R10 | **Database views**: a database is a page whose rows are pages; views as tabs above it (Table, Board, List, Gallery, Calendar, Timeline); + Add a view; each view has its own Filter, Sort, Group; New ▾ adds a row (a page) | adapt | Already designed as the list in a page (notebook rows 36, 47; built NB14). **The Notebook's own page list is one of these, a Table view**, not cards |
| R11 | **Table view**: one line a page, a Name column with the page icon, property columns, a header row with each column's type icon; "Open" appears on hover over the name; + New at the foot; 1 to 100 rows load, then "Load more" | adopt | The page list (row 10); columns Name, Folder, Edited, Created by default |
| R12 | **List view**: one line a page, the title and up to three properties right-aligned in muted text; no cards | adopt | The default list in the side list's Pages group when searched |
| R13 | **Gallery / Board**: cards, only when chosen | adapt | Kept only as a choice in a list in a page (row 47); never the Notebook's default |
| R14 | **Menus**: one component; a search box at the top of long menus; groups with small muted headings; each item an icon, label, and the shortcut right-aligned; ↑↓ Enter Esc | adopt | The one menu (notebook rows 1–2, NB1, built) used everywhere in the shell |
| R15 | **Right-click a row** = its ⋯ menu: Add to Favorites, Duplicate, Copy link, Rename, Move to, Move to Trash, Open in new tab, Open in side peek | adapt | Pin, Duplicate, Copy link, Rename, Move to, Move to Trash, Open beside |
| R16 | **Search (Ctrl+K)**: a center dialog, recent pages when empty, results with their path, a preview | adopt | Built (NB13) |
| R17 | **Empty page**: "Press Enter to continue with an empty page, or pick a template" under the title; the body's hint "Write, press 'space' for AI or '/' for commands" shows **only on the focused empty line** | adapt | Only the focused empty line hints "Type / for a block"; no line of words under the page (fixed on `fix/block-placeholder`) |
| R18 | **Undo**: Ctrl+Z / Ctrl+Shift+Z (Ctrl+Y) anywhere in a page, across blocks, including a block deleted or moved | adopt | Row 33 |
| R19 | **Lock page**: ⋯ › Lock page; a lock chip at the top; clicking it unlocks | adopt | Notebook row 32 (built in the editor); row 34 makes it hold in the shell |
| R20 | **Favorites / Recents / Home / Inbox / Teamspaces / AI / comments / sharing / Updates** | skip | One person, no AI; Recents and Pinned cover the rest |

## Directions

### A. One Notebook view, opened in place (Notion's model)

The Notebook is one view: the side list on the left, the open page to its right. A click on a page, New page, a
search result or a link **replaces** the page shown, in the same place, and the trail goes back. Ctrl+click (or
Open beside) puts a page side by side, at most two. A page from a list in a page opens as a side peek. There are no
hidden tabs inside the Notebook. The reader stays where it is (the Notebook is one pane of the window as today).

*Costs:* the Notebook stops making a dock tab per page; several pages at once (S32) become two side by side and the
trail. Smallest, most like Notion, removes the hidden-tab bug at its root.

### B. Keep a tab per page, open in the focused pane

Every page stays a dock tab, but New page and a click open in the **pane that has focus**, in front, never behind.

*Costs:* fixes the symptom; keeps the tab bar and hidden tabs the person called clunky (f_…180004, f_…175000).

### C. Pages as "attachments" (the person's idea, f_…180004)

Rethink tabs and panes for the whole window: opened things are light attachments that dock, snap to corners and group
(f_…002147), not browser tabs. A design of its own, for every kind of tab, not only pages.

*Costs:* large; touches every pane. It does not have to wait: A works inside whatever C becomes.

### Recommendation

**A now, C next as its own folder (`panes`).** A gives the Notebook Notion's open-in-place feel and removes the
New-page bug; C answers the person's findings on tabs for the whole window. B is not recommended.

## Decisions (the person, 2026-11-22)

- **Round 1 accepted, direction A: open in place.** Asked to choose A, B or C, the person answered "i like it". A page opens in place; Ctrl+click opens one beside; no hidden tabs inside the Notebook. B is not built. C (attachments for the whole window) is its own folder, `panes`, later.
- Open questions 2–4 take the frames' answers unless the person says otherwise: columns Name, Folder, Edited, Created; Today only in Recents; a trashed page opens read-only under the band.

## The person's findings that touch it (read only)

| Finding | In short |
|---|---|
| f_20261122232828_e7ab | Places and threads still there; most of the old Notebook code is still here |
| f_20261122232744_09b7 | Ctrl+Z, Ctrl+Y do not work |
| f_20261122232700_021e | Locking and unlocking a page does nothing |
| f_20261120180004_3d64 | Tabs should be draggable "attachments"; icons cluttered; redesign tabs and panes |
| f_20261120175000_15cc | Fullscreen a set of tabs; tabs without getting lost or wasting memory |
| (2026-11-22, chat) | The card list does not fit; Trash cannot be left; New page does not load in the same pane; stacked "type / for a block" |

## Open questions

1. Direction A, B or C (round 1).
2. The page list's default columns: Name, Folder, Edited, Created (round 1, frame 10).
3. Does Today (the day page) stay in the side list when its setting is on, or only in Recents (round 1, frame 1)?
4. A page in the Trash opened from a link: read-only with the band (R8), or not opened at all (round 1, frame 22).

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-22 | 1–40 | The shell like Notion: side list as a page tree, open in place, Trash as a popover, the list as a table, the old pane removed | Accepted, direction A, 2026-11-22 |

## The real conditions

| Condition | Window |
|---|---|
| Among other tabs | 30 (the Notebook as one pane beside the reader) |
| Floating | 31 |
| Narrow | 32 (the side list folds to a path) |
| Years of study | 33 (400 pages, deep tree, a search) |

## Interaction table

Objects and words from [the Library map](../../LIBRARY.md): page, folder, save, Unfiled, Trash, trail, filter, page
property. No word "note", "thread", "place", "Inbox", "Days" or "Questions tab" appears in the shell.

### The side list (frames 1–9)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 1 | Notebook | Open the Notebook | The side list (240 px) and the last page opened to its right. Side list, top to bottom: Search, New page (pen); Recents (8), Pinned, Folders, Pages; foot: Templates, Trash. No tabs, no cards, no Days / Places / Questions | Nothing | `wb page tree` | `shell_side_list_groups` | [ ] |
| 2 | Side list | Click a group's heading | The group folds or opens; kept after a restart | `settings/pages.json` `folded` | none (window) | `shell_group_folds_and_is_kept` | [ ] |
| 3 | Side list row | Hover | ▸ at the left if the page has pages inside; ⋯ and + at the right; nothing shown otherwise | Nothing | — | `shell_row_hover_controls` | [ ] |
| 4 | Side list row | Click ▸ | Its pages inside open beneath, indented 12 px; "No pages inside" when empty | `settings/pages.json` `open` | `wb page tree` | `shell_tree_disclosure` | [ ] |
| 5 | Side list row | + | A new page inside this one opens in place (row 11), title focused; the row opens to show it | New page with `parent:` | `wb page new "" --parent ID` | `shell_plus_makes_page_inside` | [ ] |
| 6 | Side list row | Drag between rows / onto a row | A line between rows / a box on the row; dropped, the order or parent changes | `settings/pages.json` order; `parent:` | `wb page move` (*proposed:* `--after ID2`) | `shell_drag_reorders_and_nests` | [ ] |
| 7 | Side list | Folder row | Its color dot, name, count; ▸ shows its pages and saves | Nothing | `wb thread list` | `shell_folder_row` | [ ] |
| 8 | Side list | Ctrl+\\ or ‹‹ | The side list folds away; the page takes the room; ›› at the top-left brings it back | `settings/pages.json` `side` | — | `shell_side_list_folds` | [ ] |
| 9 | Side list edge | Drag | Width 200–420 px, kept | `settings/pages.json` `side_w` | — | `shell_side_list_resizes` | [ ] |

### The page list (frames 10–12)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 10 | Side list | Click Pages' heading text, or "All pages" | The page list in the main view as a **table**: Name (icon and title), Folder, Edited, Created; one line a page; newest edited first; filter chips above (filters-v2); + New page at the foot. No cards | Nothing | `wb page tree` (*proposed:* `--sort edited`) | `shell_page_list_is_a_table` | [ ] |
| 11 | Page list | Click a header | Sorts by that column; again reverses | `settings/pages.json` `list_sort` | *proposed:* `wb page tree --sort title` | `shell_page_list_sorts` | [ ] |
| 12 | Page list | Hover a name, click | "Open" on hover; the click opens the page in place (row 13) | Nothing | — | `shell_page_list_opens_in_place` | [ ] |

### Opening a page (frames 13–17)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 13 | Anywhere in the Notebook | Click a page (side list, list, link, search) | The page **replaces** what the main view showed, at its top; its row is lit in the side list; the path above the title | Trail step | `wb history add` | `shell_click_opens_in_place` | [ ] |
| 14 | A list in a page | Click a row | A side peek: the page on the right half over the list, ⤢ to open it full, Esc closes | Nothing | — | `shell_side_peek` | [ ] |
| 15 | Anywhere | Ctrl+click, or ⋯ › Open beside | The page beside the open one (two at most; a third replaces the right one) | Nothing | — | `shell_open_beside_two_at_most` | [ ] |
| 16 | Page top | ← → or Alt+← / Alt+→ | Back and forward through the pages opened (the trail) | Nothing | `wb history list` | `shell_back_forward` | [ ] |
| 17 | Side list | New page (pen), or Ctrl+N in the Notebook | A blank page **in place**, title focused with "Untitled" as its hint; listed at the top of Pages at once; leaving it with no words removes it | A page file once a word is typed | `wb page new ""` | `shell_new_page_opens_in_place` | [ ] |

### Deleting and the Trash (frames 18–24)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 18 | ⋯ / right-click | Move to Trash | The row leaves; toast "Moved to Trash · Undo" (30 s); if it was open, the previous page in the trail opens | Into `.trash/` with its pages inside | `wb page rm ID` | `shell_move_to_trash_with_undo` | [ ] |
| 19 | Toast | Undo | The page is back where it was, in the tree and open if it was | Back from `.trash/` | `wb trash restore NAME` | `shell_trash_undo` | [ ] |
| 20 | Side list foot | Trash | A **popover** beside the side list: a search box, then trashed pages (title, where it was, days left); ↺ and 🗑 on hover | Nothing | `wb trash` | `shell_trash_is_a_popover` | [ ] |
| 21 | Trash popover | Esc, click outside, or Trash again | The popover closes; the Notebook is exactly as it was | Nothing | — | `shell_trash_leaves` | [ ] |
| 22 | Trash popover | Click a row | The page opens in place, read-only, with a red band "This page is in the Trash · Restore · Erase now" | Nothing | *proposed:* `wb trash show NAME` | `shell_trashed_page_band` | [ ] |
| 23 | Trash popover / band | ↺ Restore | Back in its place; the band leaves | Back from `.trash/` | `wb trash restore NAME` | `shell_trash_restore` | [ ] |
| 24 | Trash popover / band | 🗑 Erase now | "Erase <title> now? It cannot be undone." Erase / Cancel | Removed from `.trash/` | `wb trash erase NAME` | `shell_trash_erase_now_asks` | [ ] |

### Menus (frames 25–29)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 25 | Row ⋯ or right-click | Open | The one menu: Pin, Rename, Duplicate, Copy link, Move to…, Open beside, Move to Trash; foot: Edited, word count | Nothing | — | `shell_row_menu_items` | [ ] |
| 26 | Row menu | Rename | The row's title becomes a field in place; Enter keeps, Esc leaves | `title:` | `wb page title ID "T"` | `shell_rename_in_place` | [ ] |
| 27 | Row menu | Move to… | The one menu as a picker of pages and folders, searchable | `parent:` or the folder's set | `wb page move ID --parent ID2` / `wb shelf move` | `shell_move_to_picker` | [ ] |
| 28 | Row menu | Pin / Unpin | Into or out of Pinned at once | `settings/pages.json` | `wb page pin ID` / `wb page unpin ID` | `shell_pin` | [ ] |
| 29 | Row menu | Duplicate | "<title> (copy)" under it, opened in place | A new page | `wb page duplicate ID` | `shell_duplicate` | [ ] |

### Real conditions (frames 30–33)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 30 | Window | The Notebook beside the reader | The Notebook is one pane; the side list and page fit inside it; nothing opens a hidden tab | Nothing | — | `shell_beside_reader` | [ ] |
| 31 | Window | The Notebook floating | Same, the side list folded by default under 700 px | Nothing | — | `shell_floating` | [ ] |
| 32 | Narrow (< 560 px) | Open the Notebook | The side list fills the pane; a page opens over it with ‹ back to the list | Nothing | — | `shell_narrow_path` | [ ] |
| 33 | 400 pages, 6 deep | Scroll, search | The tree draws only open rows; search answers under 100 ms; Recents and Pinned on top | Nothing | `wb find` | `shell_years_of_study_budget` | [ ] |

### The page inside the shell (frames 34–36), bugs of 0.3.0 the shell must not repeat

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 34 | Page ⋯ | Lock page / the lock chip | Locked: typing does nothing, a lock chip at the top; clicking the chip unlocks; holds after reopening | `settings/pages.json` `look.locked` | `wb page lock ID on|off` | `shell_lock_holds` | [ ] |
| 35 | A page | Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z | Undo and redo typing, a block deleted, moved or turned into; never opens the command box | The page as before | `wb block …` | `shell_undo_redo_in_page` | [ ] |
| 36 | A page | An empty line | Only the focused empty line hints "Type / for a block"; no words under the last block | Nothing | — | `only_the_focused_empty_line_shows_the_hint` (on `fix/block-placeholder`) | [ ] |

### What goes (frames 37–40)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 37 | Notebook | — | No Days / Pages / Places / Questions tabs, no cards, no "No place yet", no Inbox | Nothing | `wb notebook list` keeps its contract for the terminal | `shell_no_old_sections` | [ ] |
| 38 | Notebook | — | No Threads group; a folder with a color is a folder (TH-1) | Nothing | — | `shell_no_threads_word` | [ ] |
| 39 | Settings | — | The old Delete All form leaves the Notebook; `wb page rm --all` stays for the terminal | Nothing | `wb page rm --all` | `shell_no_delete_all_form` | [ ] |
| 40 | Code | — | The old pane's list, Trash view and page opening are removed from `ui/src/notebook.ts` in the ticket that replaces each; the shell is its own module | Nothing | — | the tests above, and a size check: `notebook.ts` under 800 lines | [ ] |

## Tickets (proposed, once accepted)

| Ticket | Rows | What |
|---|---|---|
| SH1 | 1–4, 7, 37, 38, 40 (part) | The side list and tree, the old list removed |
| SH2 | 13, 15, 16, 17, 30–32 | Opening in place (direction A), New page in place |
| SH3 | 18–24, 39 | Move to Trash, the Trash popover, the band |
| SH4 | 25–29, 5, 6 | The row menu, Rename, Move to, Pin, Duplicate, +, drag |
| SH5 | 10–12, 14 | The page list as a table, side peek |
| SH6 | 34, 35, 8, 9, 33 | Lock and undo in the shell, folding, width, the budget |

## What the build must satisfy

Written once the person accepts a direction.

## Out of scope / later

- Tabs and panes for the whole window (direction C): its own folder, `panes`, next.
- The study folder the installed app opened (`Documents\wordbench-study-data`): the person points Settings › Study
  folder back at `bible-study-data`; no code change.
