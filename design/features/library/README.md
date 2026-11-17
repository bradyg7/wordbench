# The library: the Notebook, the Shelf, and keeping

**State:** accepted by the person 2026-11-17 (ready to build); was exploring (round 4 drawn 2026-11-16) · **Sheets:** `python design/features/library/library.py` writes `library.figcraft` and
`library.pdf` (the board, one vector page) · Nothing here is built yet. What other tools get wrong, and so what this folder avoids:
[bible-software-complaints](../../research/bible-software-complaints.md).

**Readiness: likely finished** (2026-11-16, the Notebook pass, by [ready-criteria](../ready-criteria.md)); the person
accepted it on 2026-11-17, with the recommendations on the five study-folder formats (L-21 to L-25). The earlier mark (unfinished: checks 1, 2, 4, 5, 6) is replaced. Inferences
first: L-5 (the Shelf), L-9 (round 4 leads, never reviewed by the person), L-10 to L-20; L-9 carries the most.

- **1** round 4 leads (L-9); superseded windows S1-S4, S12, S14, S16 are hidden by `DROP` (`library.py:1397`) and
  absent from the rendered board; S27 is redrawn with one line of text and no chips (`library.py:939`, `:1180`), S31's
  menu has no Page history (`:1260`), S13 has no tab row (`:464`).
- **2** every question after round 3 is struck; "Needs the person" 1-5 were study-folder formats, each with a
  recommendation; decided by the person 2026-11-17 (L-21 to L-25).
- **3** S33-S36 drawn, with S10, S15, S17, S18, S24 for rounds 1-3.
- **4** every line names inputs and a result; the lines once marked *(format)* now name the decided form (L-21 to
  L-25); the reader's place is its own line.
- **5** existing commands named; `wb save`, `wb folder …`, `wb find --kind …`, `wb page duplicate | link`, several-id
  `wb page rm | move | pin`, `wb page look` named as required.
- **6** [overlaps](../overlaps.md) "Choosing and deleting several pages" (L-13), "Templates" (L-14), "Today's page"
  (L-18), "Saved views" (L-15), "Margin notes in the Library" (L-11) and "What a mark is" (L-6) resolved;
  [coverage](../coverage.md) gives Notebook, Shelf, day and `note`, `page`, `block`, `set`, `shelf` to this folder.
- **7** agrees with [settings](../settings/README.md) (accepted: Notebook keeps Today's page, What it opens with,
  Places open in, Quick capture; links always on, `settings/README.md:114`), [trash](../trash/README.md) (accepted:
  L-13) and [minimize](../minimize/README.md) (bc07, L-4).
- **8** fixed on this pass: S8's "never colors the text" read against threads' colored folders, settled by L-20;
  round 1's proposals marked as reviewed. Scripture through `build.C` from `design/content.json`; phrases cut by word
  position.
- **9** nothing suggested on the board. **10** formats were "Needs the person" 1-5, with the migration steps written;
  decided by the person 2026-11-17 (L-21 to L-25). Each adds to today's files and reads the old form; no file of the
  person's is moved by the decision, and any move happens once, designed, tried on a scratch copy after a hashed backup
  (`scripts/backup-study.ps1`), with the person's go-ahead.

The person accepted S25 (the side list), S28 (the page), S29 (writing), S26, S27, S31, S32, S30, S33-S36, and rounds
1-3 (S7, S5, S11, S8, S17, S20, S21, S13, S19, S22, S10, S15, S18, S23, S24, S6, S9) on 2026-11-17.

The Notebook and the Shelf "conceptually don't have to be separate": folders and pages working together, and a
bookmark that is "almost second nature ... a one or at most two step process, especially to retrieve it" (the person,
findings f_20261111150806_c43b, f_20261111002622_9413, f_20261108005250_1d0e; review of 2026-11-11). It touches the
Notebook drawer, the Shelf and its sets, every place something can be kept, and the minimize rounds' rail and trail.

## Leading design (2026-11-16)

The board and its PDF hold only these windows. Superseded ones are left off the board by the script's `DROP` list (see [lead.py](../lead.py)); their drawings are in git history (commit `0d59600`).

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Saving | S7 (the picker at once), S5 (the same mark everywhere), S11, S15 | S1, S2 (by S7) |
| How saves show | S8, S17 | S16 (its right margin, by marks M25-M26) |
| Folders and what is open | S6, S9, S10, S13, S18, S19, S22 | S4 (by S10, S19, S22) |
| The Library | S20 (five pieces), S21 (one search), S23 (the page editor), S24 (narrow) | S3 (by S20, S24), S12, S14 (unclear in review; by S20) |
| The Notebook like Notion (round 4; leading by L-9) | S25 (side list), S26 (right-click menu), S27 (one filter line), S28 (the page), S29 (/ and the selection bar), S30 (side by side), S31 (the page's … menu; Notebook settings to Settings), S32 (many pages at once) | S27's chips and Place (by L-8); S31's Page history (by L-16); the Threads rows of S25 (by L-10) |
| The real conditions | S33 (floating), S34 (among ten tabs), S35 (narrow), S36 (years of study); S18, S24, S15, S17, S10 for rounds 1-3 | |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| ad58 (2026-11-06) | The `[[` pop-up of pages has no scroll bar or order; should look cleaner |
| c43b (2026-11-11) | A verse goes into a thread quickly but not onto the Shelf; bookmarking in one or two steps |
| 9413 (2026-11-11) | Removing a tab from a Shelf set does not close it; what the Shelf is for |
| 4463 (2026-11-08) | A clear, clean filter for the Notebook |
| 929e (2026-11-06) | Notebook groupings collapsible |
| 6ed1 (2026-11-08) | A new block pops a border and white box; should be plain inline text, as in Notion |
| b737 (2026-11-08) | Right-click a page in the Notebook for options, as in Notion |
| 1d0e (2026-11-08) | The Shelf needs to be figured out |
| 23f1 (2026-11-08) | Places viewer: chapters grouped by book, with collapse all |
| bd54 (2026-11-08) | Templates do not wrap text well |
| 64c7 (2026-11-08) | Dragging blocks does not work yet |
| c301 (2026-11-09) | The Notebook's side panel can be minimized |
| f990 (2026-11-09) | Clicking a card edits its markdown; wants a friendlier way to change the card |
| 2c9c (2026-11-09) | The Notebook should work more like Notion than Obsidian |
| c940 (2026-11-09) | No simple way to add a new line in a page |
| 65b1 (2026-11-10) | Leaving a new scripture block scrolls the page back to the top |
| 6e30 (2026-11-11) | No heading/bold/italic bar; the inside of a page as close to Notion as can be |
| bd7b (2026-11-11) | No Ctrl+Z or the usual editor keys in a page (it opens the command box) |
| f126 (2026-11-11) | The line break block looks clunky beside the rest |
| b91a (2026-11-11) | Intuitive for anyone: the old preacher, the new reader, the busy mother, the missionary |
| 5f45 (2026-11-11) | Clicking the place of a Strong's word page goes to the reader and opens nothing |
| 0960 (2026-11-12) | Lag while writing in a page; check how pages are stored and loaded |
| 9b88 (2026-11-12) | A clear title field and body instead of "the first line is the title" |
| 95db (2026-11-12) | Find phrases quoted from scripture in a page and offer the card or a quiet tag; spell check that stays after leaving a block |
| 6659 (2026-11-13) | In full screen, blocks side by side and the page centered (left-aligned), as in Notion; as now when shrunk |
| e09e (2026-11-06) | Everything under the Notebook's … needs re-examining for its value |
| 4c02 (2026-11-08) | Collapse all threads in the Notebook |
| 0ade (2026-11-09) | Delete many pages at once |
| d84d (2026-11-09) | A thread's verses missing from its page; is a separate Threads tab still needed |
| fc71 (2026-11-16) | The notes page very similar to Notion's design |
| bc07 (2026-11-16) | Clicking an old trail makes a new page instead of showing the trail |
| d2a1 (2026-11-13) | The grab handle shows only on hovering that block |

## Decisions so far (the person, 2026-11-11, from the minimize rounds)

- **The Notebook is pages and the Shelf.** The Inbox goes (nothing is received; a page need not have a place). The
  Questions tab goes (questions stay inside pages as callouts). Today is a page you can choose to show.
- **The bookmark beside a minimized tab ("keep on the Shelf") is the starting point** for what a bookmark means.
- **One rail button for the Notebook**; the Shelf lives inside its drawer.

## Proposed in round 1 (reviewed 2026-11-11; the review and L-1 to L-20 replace it where they differ)

- **Keep is one step on anything that can be opened** (a verse, a word, a Concordance entry or place, a search, a page,
  a document, a trail): the bookmark, or K. It lands on the Shelf at once, with Undo.
- **A folder is the optional second step** (Put in a folder…, or K twice): a small picker with the folders used last.
- **A folder holds pages and kept things alike.** It is today's Shelf set under a new name, so the file and its format
  stay as they are (`wb set …`); the Shelf is what is kept but in no folder.
- **Kept is not open.** Keeping is the library, tabs are the desk. Closing a tab never unkeeps it; taking a thing out
  of a folder never closes its tab (finding 9413). Open all as tabs brings a folder back to the desk.
- **A kept verse shows a ribbon at its number** in the reader.

## Decisions (2026-11-16)

Each is **decided by overseer from existing decisions (inference)**, dated 2026-11-16, and rests on the lines named. L-1 to L-8 were written on the earlier passes; L-9 to L-20 on the Notebook pass, when the person asked not to be asked until a design is likely finished.

| # | Decision | Rests on |
|---|---|---|
| L-1 | The word is Save and the key is K. | Round 1 review |
| L-2 | One tree: folders hold pages and saves and nest; pages nest in pages as parts of one writing. | Round 1 review; Round 3 review (S20) |
| L-3 | One thing can sit in several folders, or none. | Round 1 review (S5, S11); Round 3 review |
| L-4 | A sitting can be saved as its own object in a folder. "Keep as a page" stays a separate action, as built. Clicking an old trail shows the trail (bc07, a bug against [minimize](../minimize/README.md)'s accepted line). | Round 1 review ("a kept trail is its own object"); minimize |
| L-5 | **An inference, not stated by the person:** saves in no folder are called the Shelf, not Unsorted. The person was not convinced by the change, S7 (liked) says "Just the Shelf", and the rail and `wb shelf` already use the word. | Round 3 review; S7; minimize |
| L-6 | The right margin belongs to [marks](../marks/README.md) (M25-M26); S16's right margin is closed here. | Leading design table |
| L-7 | Threads are decided in the [threads](../threads/README.md) folder (now TH-1: a thread is a folder with a color; see L-10). | Round 3 review |
| L-8 | Notebook settings move to Settings (S31) with the four kept settings. The Filters form and the tab row become one filter line, and the filters must be [search](../search/README.md)'s, not a second set. S27's chips conflict with marks M8 ("chips as filters are not liked"), so S27 is redrawn without chips (done 2026-11-16). | [settings](../settings/README.md); [overlaps](../overlaps.md); marks round-1 review |
| L-9 | **Round 4 leads: the Notebook works like Notion** (S25-S32): one folding side list, one right-click menu, one filter line, a centred page with a title field and properties, / for blocks and a bar on a selection, blocks side by side at full width, the page's own ⋯. Every part answers a finding of the person's (2c9c, fc71, 6e30, 9b88, b737, 6659, 6ed1, c301, 4463, 929e, e09e, d2a1, 0ade). The person has not seen the sheets; looking at them is the review. | The findings named; ready-criteria check 1 (revised 2026-11-16) |
| L-10 | **A folder can carry a color** (what a thread was). It sits in FOLDERS with its color dot; there is no Threads group, tab, filter or property. A page's properties are Folders (the folders it sits in) and Edited. | [threads](../threads/README.md) TH-1, TH-3 |
| L-11 | **Five pieces, not four** (S20): Page, Folder, Save, Margin note, Library. Margin notes get a folded row at the foot of the side list; what is in it is marks' (M30, M31). | The person, 2026-11-12, in [marks](../marks/README.md) ("the margin should have its own place in the Library"); marks MK-12 |
| L-12 | **The side list's groups, in order:** Today (only when Today's page is on in Settings), Pinned, Folders, Pages, then two folded rows: Margin notes and the Shelf, each with a count (S25). Every group folds (929e, 4c02); a row shows ⋯ and + only under the pointer or on keyboard focus (d2a1). | S25; round 3's line (S20); library decision "Today is a page you can choose to show" |
| L-13 | **Choosing several pages is the library's** (S32): Shift or Ctrl click, a bar with the count and Move to, Pin, Delete. Delete follows [trash](../trash/README.md) TR-2 and TR-3: one toast, one Undo for all for 30 seconds, then 7 days in the Trash. | 0ade; trash (accepted); `docs/SPEC.md:32` |
| L-14 | **A page template and a document are different things.** `wb template` makes a page from a page; a document is made from a page and keeps its own choices ([documents](../documents/README.md) DC-2). No shared builder. | documents DC-2 |
| L-15 | **A kept search is "a saved list"**: a block in a page holding the line (`wb view run`, `wb block view`). The filter line's menu has "Keep as a list in a page". One name everywhere ([settings](../settings/README.md) S5, [questions](../questions/README.md) Q6). | settings S5; marks M8 ("Keep as a list in a page") |
| L-16 | **Page history leaves the page's ⋯** (S31). Keeping earlier versions of a page was a format question asked in marks; the person decided not yet (marks MK-19, 2026-11-17); nothing here depends on it. | marks |
| L-17 | **The / menu offers Saved thing (/save), not a thread block** (S29). A ```` ```thread ```` fence already in a page keeps working and shows the folder's saves (threads TH-3). | threads TH-3 |
| L-18 | **Today's page is never required**: nothing in the Notebook writes to it unless the person switched it on; a question with no verse goes in the page in front ([questions](../questions/README.md) QN-3). | minimize round 5 (Today optional); questions QN-3 |
| L-19 | **S13 (Folders, liked in round 2) keeps its cards but loses its Notebook / Folders / Shelf tab row**: S20 says the Library replaces those tabs. | Round 3 review (S20 is the line) |
| L-20 | **"A save never colors the text" (S8) and a colored folder agree:** a whole saved verse is shown only by its mark in the left margin, in the folder's color when the folder has one and its eye is on; a saved phrase or word in such a folder has the folder's line under it ([threads](../threads/README.md) TH-7, [marks](../marks/README.md) M15). No save fills or inks the words. (Added 2026-11-16, the Notebook pass.) | S8 (liked); threads TH-7; marks M15 |

L-5 can be reversed with a word from the person.

## Decisions (the person, 2026-11-17)

Each is **decided by the person 2026-11-17 (accepted the recommendation)**: the overseer's recommendation under "Needs
the person", accepted as written. Each is a form for what the app writes from now on, and each reads the old form; none
moves or rewrites a file the person already has. A move of the person's files happens once, designed first, tried on a
scratch copy after a hashed backup (`scripts/backup-study.ps1`), and only with the person's go-ahead for that run.

| # | Decision | Rests on |
|---|---|---|
| L-21 | **A title field (S28, 9b88):** `title:` in the page's front matter, with the first line read as the title where the field is absent, so no file has to move at once. `[[title]]` links resolve through the title (`crates/wb-core/src/pages.rs`), so the reader takes the field first. A page whose first line and `title:` differ after an edit outside the app: the field wins and `wb study check` reports it. | The person, 2026-11-17 (was "Needs the person" 1) |
| L-22 | **Pages in folders (S25):** membership is kept in the folder's set file; page files are not moved into directories (a thing may sit in several folders, L-3, which directories cannot express). Nested folders take a parent field in the set file (a format addition; `wb shelf move --in` already nests). A folder's file and its pages can drift if a page file is deleted outside the app; `wb study check` reports dangling items. This is the folder format [threads](../threads/README.md) TH-12 waits on: moving thread files into it is a later, one-time move of its own. | The person, 2026-11-17 (was "Needs the person" 2) |
| L-23 | **Columns (S30):** comment markers in the Markdown (as threads use `<!-- anchors -->`), so the file reads top to bottom in any editor and stacks when narrow (6659). A marker deleted by hand unbalances the columns; unbalanced markers are read as plain blocks. | The person, 2026-11-17 (was "Needs the person" 3) |
| L-24 | **A saved sitting (L-4)** is a kind of set item pointing into `history/`. | The person, 2026-11-17 (was "Needs the person" 4) |
| L-25 | **Full width and Small text (S31)** are kept per page in `settings/pages.json` beside Pinned, not in the page's own file, so the person's writing is not touched by a view choice. | The person, 2026-11-17 (was "Needs the person" 5) |
| L-26 | **Decided by overseer, inference, 2026-11-17 (for the person's look):** the Shelf's saves (saves in no folder) are stored under key `saves` in `settings/shelf.json`, additive, written per key, old files read unchanged. The `wb save` thing is named as built: a place, a phrase or an H/G-number bare (`Num 25:11`, `NUM.25:11.4`, `H7065`); `page:<id>`, `search:"…"`, `document:<name>`, `sitting:<id or last>`, and `thread:<slug>`. | L-3, L-5, L-22 (no file for loose saves was named) |

## Needs the person

Nothing. All five were answered by the person on 2026-11-17 (accepted the recommendation):

1. ~~A title field (S28, 9b88).~~ `title:` in the front matter, the first line where absent: L-21.
2. ~~Pages in folders (S25).~~ Membership in the folder's set file, a parent field for nesting: L-22.
3. ~~Columns (S30).~~ Comment markers in the Markdown: L-23.
4. ~~A saved sitting (L-4).~~ A set item kind pointing into `history/`: L-24.
5. ~~Full width and Small text (S31).~~ In `settings/pages.json`: L-25.

L-5 (the Shelf, not Unsorted) was item 6 here; it is a label, not a format, so it is decided (L-5) and was left for the
person's look at the sheets, not asked.

Threads (the old question 5) are answered in [threads](../threads/README.md) (TH-1; decided by the person 2026-11-17,
TH-11).

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-11 | S1-S6 | Keep a verse in one step with a toast (S1), the folder picker (S2), the library drawer with pages, folders and the Shelf (S3), a folder opened as cards with Open all as tabs (S4), the same bookmark everywhere (S5), kept is not open (S6) | Round 1 review below |
| 2 | 2026-11-11 | S7-S14 | Save opens the picker at once, several folders by ticking, Just the Shelf, Esc keeps it unfiled (S7); saves in the reader margin: whole verse, phrase, several on a line, never coloring text (S8); what + adds (S9); a big folder opened as a list, open only what you tick, more than 10 asks (S10); one save in several folders (S11); the three views: Shelf as the bookmark manager (S12), Folders (S13), Notebook (S14) | Round 2 review below |
| 3 | 2026-11-11 | S15-S24 | The picker with dozens of nested folders (S15); saves in the left margin and your pages in the right margin (S16); 30 saves on one verse, grouped by folder (S17); "What is open now" with ten tabs (S18); reaching a folder by clicking it, Cards with folders (S19); four pieces defined, the Shelf folded into Unsorted (S20); one library search (S21); cards: click, drag, menu (S22); the page editor and New page (S23); the Library in a narrow column (S24) | Round 3 review below |
| 4 | 2026-11-16 | S25-S36 (redrawn the same day for L-10 to L-13, L-16, L-17) | The Notebook like Notion, from the installed build of 16 November: one folding side list with folders above pages and hover-only ⋯/+ (S25); one right-click menu (S26); one filter line of chips instead of the Filters form and the Days/Pages/Places/Threads/Questions/All tabs (S27); the page centred with a title field and properties, plain text lines (S28); / blocks and a selection bar, no top toolbar (S29); blocks side by side at full width (S30); the page's own … menu, Notebook settings moved to Settings (S31); choosing many pages, one Delete (S32); then the real conditions: floating (S33), among ten tabs (S34), narrow (S35), 412 pages with forty loose (S36) | Leading by L-9 (2026-11-16). Accepted by the person, 2026-11-17 (with L-21 to L-25) |

## Data the sheets show

Scripture and the H7065 entry come from `design/content.json` (generated from the database by `design/content.py`),
read through `build.C`. Nothing is typed by hand: every phrase shown alone is cut from its verse by word position (`cut`, asserted inside the verse).

## The real conditions

| Condition | Window |
|---|---|
| Among other tabs | S34 (the Notebook as one of ten tabs, 3 more listed); S18 (What is open now, ten tabs) |
| Floating | S33 (the page and its list as a floating window) |
| Narrow | S35 (a 420 px column: the list as a path, opened); S24 (the Library in a narrow column) |
| Years of study | S36 (412 pages, forty loose, a filter answering 23 of 412); S15 (dozens of nested folders in the picker), S17 (thirty saves on one verse), S10 (a big folder) |

## What the build must satisfy

Each line is checked in a Rust test or the desk check, on a generated scratch study (never the real folder). The
study-folder forms are L-21 to L-25 (the person, 2026-11-17); every line can be built.

Saving and folders (rounds 1-3)

- [ ] **Save.** K on a verse, a phrase, a word, a Concordance entry, a search, a page, a document or a sitting opens the picker at once; ticking two folders puts the save in both; "Just the Shelf" or Esc leaves it on the Shelf; the mark is filled wherever that thing is shown, and hovering it names the folders (S5, S7, S11). No toast carries a second step.
- [ ] **Saved is not open.** Closing a saved thing's tab leaves the save; removing a save from a folder leaves its tab open (S6, 9413).
- [ ] **Saves in the text.** A saved verse shows a mark in the left margin, a saved phrase a mark beside its line; three saves on one line show one mark with the count 3; no save fills or inks the words, and the only line under them is a saved phrase's in a colored folder whose eye is on (S8, L-20). Thirty saves on one verse open as a list grouped by folder (S17).
- [ ] **A big folder.** A folder opens as Cards or List (the last choice is remembered); Open ticked opens only what is ticked, and more than 10 asks first with the number (S10, S19, S22).
- [ ] **The picker at size.** With 60 folders, 3 levels deep, the picker shows the folders used last first, then the tree folded, and typing narrows it by name (S15).
- [ ] **One search.** The Library's search finds pages (by title and text), folders, saves and margin notes in one list grouped by kind; its field menu narrows to Pages, Saves, Questions or Margin notes and shows the choice as one line of text with Clear; there are no chips (S21, marks M21).
- [ ] **Five pieces.** A folder has no text of its own; a page cannot hold saves except as a Saved thing block; a margin note cannot be filed or pinned (S20).

The Notebook like Notion (round 4)

- [ ] **The side list.** Its groups are Today (only when Settings › Notebook › Today's page is on), Pinned, Folders, Pages, then the rows Margin notes and the Shelf with counts; each group folds and stays folded after a restart; a row shows ⋯ and + only under the pointer or on keyboard focus; + on a page makes a page inside it; the pen at the top makes a loose page (S25). No row or group is named Threads, Inbox, Questions, Days or Places.
- [ ] **A folder with a color** shows its dot in Folders and nowhere among Pages (S25, L-10).
- [ ] **Right click.** A right click on a page row (or its ⋯) opens one menu: Open, Open beside the reader, Rename, Duplicate, Move to…, Pin, Copy link, Delete (S26); each does what its `wb` command does (below).
- [ ] **One filter line.** The search box's menu offers Kind, Folder, Has a question, Edited, and the sorts Last edited and Title A-Z; what is on shows as one line of text under the box with Clear; the old Filters form and the Days / Pages / Places / Threads / Questions / All tab row are gone (S27).
- [ ] **The page.** The page is centred, at most 720 px of text, with its path above; under the title its properties are Folders and Edited and nothing else; there is no toolbar above the text (S28, 6e30).
- [ ] **Writing.** / on an empty line opens the block menu (text, headings, lists, to-do, quote, divider, table, scripture, word, question, Saved thing, page); selecting text shows a bar with bold, italic, heading, link, highlight; Ctrl+Z and Ctrl+Y undo and redo typing in the page and do not open the command box (S29, bd7b); Enter makes a new line (c940); a new block has no border or box (6ed1); leaving a scripture block does not scroll the page (65b1).
- [ ] **The page's ⋯** holds Full width, Small text, Pin, Move to…, Copy link, Make a document…, Find scripture… ([tether](../tether/README.md) TG-12, accepted 2026-11-17), Delete, and nothing else; the Notebook has no ⋯ of its own, and Today's page, What it opens with, Places open in and the Quick capture key are in Settings › Notebook (S31, [settings](../settings/README.md)).
- [ ] **Several pages.** Shift click or Ctrl click chooses rows; the bar says "3 chosen" with Move to…, Pin and Delete; Delete shows one toast with one Undo for 30 seconds and each page then waits 7 days in the Trash (S32, [trash](../trash/README.md) T10).
- [ ] **A title field.** The title is its own field above the body, kept as `title:` in the page's front matter; changing it rewrites `[[links]]` to the page as `wb note relink` does; a page with no `title:` shows its first line as the title and is not rewritten until edited; a page whose `title:` and first line differ shows the field and is reported by `wb study check` (S28, L-21).
- [ ] **Side by side.** At Full width two blocks dragged beside each other make two columns, kept as comment markers in the page's Markdown; in a pane narrower than 700 px they stack in reading order; the file reads top to bottom; with one marker deleted by hand the blocks are read as plain blocks and nothing is lost (S30, L-23).
- [ ] **Among other tabs, floating, narrow.** As one of ten tabs the Notebook keeps its list and page; floated, the list folds to the path above the page under 560 px; in a 420 px column the list is a path that opens over the page, and the title, properties and text keep their order (S33, S34, S35).
- [ ] **Years of study.** With 412 pages (forty loose), 140 folders and 86 margin notes the side list opens inside the list budget of `npm run measure`; Pages shows its newest 20 and "Show all"; a filter line answering 23 of 412 says "23 of 412"; typing in a page of 400 blocks stays inside the typing budget (S36, 0960).
- [ ] **The reader's place is kept.** From Numbers 25:11 in the reader, K, saving, opening the Library, opening that save from its row and going back returns to the Library row it was opened from; closing the Library leaves the reader at Numbers 25:11 at the same scroll position. A reference clicked inside a page opens the verse, and Back returns to the same block of the page.
- [ ] **Commands.** Existing and kept: `wb set …`, `wb shelf`, `wb shelf new | move | rm | item`, `wb page tree | new | move | pin | unpin | title | rm | undo | blocks`, `wb block …`, `wb template …`, `wb notebook`, `wb notebook sidebar`, `wb find`, `wb view run`, `wb settings notebook`, `wb history keep`, `wb day …` (only when Today is on). Required and missing today:
  - `wb save <thing> [--folder <name>]…` and `wb save rm <thing> [--folder <name>]` (K and the picker; a thing is a place, a phrase, H7065, `page:<id>`, `search:"…"`, `document:<name>`, `sitting:<id>`);
  - `wb folder new | rename | move | list | rm` as the new name for the `wb shelf` folder commands (as `wb page` is `wb note`), plus `wb folder color` and `wb folder shown` ([threads](../threads/README.md));
  - `wb find --kind page | save | question | margin`, `--folder <name>`, `--has-question`, `--edited <since>`, `--sort edited | title` (the one search and the filter line);
  - `wb page duplicate <id>`, `wb page link <id>` (prints the `[[link]]` Copy link copies), `wb page rm <id> <id> …`, `wb page move <id> <id> … --parent <id>`, `wb page pin <id> <id> …`;
  - `wb page look <id> --full-width on | off --small-text on | off` (kept in `settings/pages.json`, L-25);
  - Open beside the reader is a window action: `wb do "open page <id> beside"`.
- [x] **Folders in set files.** A page put in two folders is listed in both folders' set files and its file does not move; a folder nested in another has the parent field in its set file; a page file deleted by hand leaves its folder showing nothing broken, and `wb study check` reports the dangling item (L-22, L-3). Evidence (`crates/wb-cli/tests/library.rs`): `folders_nest_in_their_own_file_and_pages_do_not_move`, `a_page_file_deleted_by_hand_is_reported_not_shown_broken`, `a_folder_edit_writes_only_the_files_it_changes` (legacy set files stay byte-identical after an unrelated folder edit).
- [ ] **A saved sitting.** Saving a sitting writes one set item of the sitting kind pointing into `history/`; opening it from the folder shows the sitting (L-24, L-4).
- [x] **The study files.** New forms are only L-21 to L-25: `title:` in front matter, membership and a parent field in set files, column markers in Markdown, a sitting item kind, per-page view choices in `settings/pages.json`. Old files are read as they are (pages with the first line as the title, today's sets) and are not rewritten by reading. No file of the person's is moved by this build: any move into a new form happens once, designed, tried on a scratch copy after a hashed backup (`scripts/backup-study.ps1`), with the person's go-ahead. Evidence: `a_folder_edit_writes_only_the_files_it_changes`, `a_pages_title_field_wins_and_check_reports_a_difference`, `page_actions_for_several_pages_and_the_pages_own_look` (the page file is byte-identical after `wb page look`); the one addition not in L-21 to L-25 is L-26.


## Open after merge

Built and tested: the data model and `wb` commands (`wb save`, `wb folder list | new | rename | move | rm`, `wb find --kind …`, `wb page duplicate | link | look`, several-id `wb page rm | move | pin`), folders in set files, a saved sitting as a set item, the `title:` field read side, dangling items in `wb study check`. Unticked lines and why:

- **Window work, S25 to S35** (the side list, right-click menu, filter line, page layout, writing, the page's ⋯, choosing several pages, side by side, ten tabs, floating, narrow): no UI built. Lines: Save's picker and mark, Saved is not open, Saves in the text, A big folder, The picker at size, The side list, A folder with a color, Right click, One filter line, The page, Writing, The page's ⋯, Several pages, Side by side, Among other tabs, Years of study (desk), The reader's place is kept (desk).
- **One search** (window field menu and Clear), **Five pieces** (window rules): the Rust search and rules exist, the window does not.
- **A title field, write side:** `wb page title` and the window do not write `title:`; doing so strips the first line from the body and shifts block numbers. Needs its own design pass.
- **Columns (L-23):** comment markers are not read or written.
- **Commands left:** `wb folder color` and `wb folder shown` (threads), `wb do "open page <id> beside"` (window action).
- **A saved sitting:** `wb save sitting:…` and `wb set show` work; opening a sitting from a folder in the window, and `wb set open`'s target, are not built.
- **Margin saves:** `wb find --kind margin` returns nothing until marks builds margin notes.
- **Dangling items in the window:** `wb study check` reports them and `wb set show` marks them `gone`; how the window shows them is not built.

## Out of scope / later

- The trail and the rail: [minimize](../minimize/README.md). The Concordance's bookmark marks: Save is owned here (L-1, S5); [concordance](../concordance/README.md) only places it (C-7).

## Round 1 review (the person, 2026-11-11)

- **The word is Save; the key is K.**
- **Save opens the folder picker at once** (S1, S2): no toast carrying "Put in a folder", so sorting happens right away
  and nobody misses it because a toast timed out. The picker's look and the key are liked.
- **The ribbon at the verse number is rejected** (it reads as a square). How a saved verse, a saved phrase and several
  saves in one verse are marked needs a deeper look (round 2, S8).
- **Folders hold anything and nest**; pages nest in pages; words sit in pages. The "+" in the drawer must say what can
  be added (round 2, S9).
- **The Shelf becomes the bookmark manager**, not a tab manager. A save can go to no folder ("just the Shelf"); somewhere
  says what the Shelf is for (round 2, S12).
- **Open all as tabs needs rework**: nested folders, long pages, folders of hundreds of sermons or lessons would
  explode into tabs, and a stray click would hurt (round 2, S10). The folder viewer of cards is liked, each card
  opening its own tab.
- **A saved mark stays filled and shows where it is saved** (S5, liked). **A save can sit in two or more folders**;
  adding it to another folder must be planned (round 2, S11).
- **The viewers are to be designed**: what the library, the Shelf and the Notebook each look like (round 2, S12, S13).
- **Threads will likely be consumed by folders**: a deeper round decides whether threads are a legacy idea and where
  they fit.
- **A kept trail is its own object**, saved in a folder like any other thing.

## Round 2 review (the person, 2026-11-11)

- **S7 liked.** Draw the picker with dozens of folders and folders inside folders (round 3, S15).
- **S8 liked: saves in the left margin** keep the feel of overlaying your thoughts on the text. Try the same for notes
  and pages that refer to a verse, on the right (S16). Draw a verse saved in several folders in the hover, what a
  click on a mark opens, and a verse with 30 saves staying readable (S17).
- **S9 liked.** "What is open now" with ten tabs open: what it adds, and what its description says (S18).
- **S10 liked** (Cards / List switch). How does one reach the folder view? Draw Cards with folders in it (S19).
- **S11 liked**, with the S7/S8 scale concerns.
- **S12 unclear.** The Shelf was "what is not filed yet"; if it is also a search of every save, perhaps one library
  search over everything (notebook, folders, saves) is better. Still unclear what the Shelf is for and what it adds
  (S20, S21).
- **S13 liked**: clean. Are its cards clickable, draggable; what do they look like? It is likely the way to S10 (S19, S22).
- **S14 unclear.** Are only pages shown? If a page holds pages, is it a folder? Define each piece's scope so they
  connect without overlapping (S20). Design the page editor in depth: Notion's features, built into this app (S23).
  What New page does (S23). How the views look narrower (S24).
- One more library round (3), then threads.

## Round 3 review (the person, 2026-11-11)

- **S20 is the line**: Page (something you write; pages inside are parts of the same writing), Folder (a place you
  sort into; no writing of its own), Save (a pointer, in any number of folders or none), Library (one tree, one search).
- **Unsorted vs Shelf: undecided.** The person is not convinced "Unsorted" is better than keeping the word "Shelf"
  for saves in no folder; which is clearer is still open. One library search (S21) was not objected to.
- **The right margin (S16): revisit.** Saves in the left margin stay liked; how pages that refer to a verse are listed
  on the right (title and first line, as drawn) is not liked yet.
- S15, S17, S18, S19, S22, S23, S24 drew no objection; not yet accepted.
- Next: threads, in their own design folder and session (`design/features/threads/`): whether folders take threads
  over, and where a thread fits.

## Round 4: what the installed build showed (2026-11-16)

- The Notebook has Filters (Kind, Place, Thread, Questions) and a tab row (Days, Pages, Places, Threads, Questions, All): two filters for one list. The list still says "All notes".
- Notebook settings (…): Today's page, Links between notes "as in Obsidian", Opens with, Places open in, Quick capture, Templates.
- The side list has Today, Pinned, Pages (77): pages nest, threads are dotted rows, about forty one-line pages sit loose at the root.
- A page has a breadcrumb, a title taken from the first line, chips (place, thread) and a toolbar (H B I lists quote Place [[ ]] ?) that 6e30 asks to remove. Text lines are already plain with a hover grip.

## Open after round 3 (all closed)

- ~~The name for saves in no folder: Shelf or Unsorted.~~ Shelf (L-5, an inference); struck 2026-11-16.
- ~~How pages that refer to a verse show beside the text (S16's right margin).~~ [marks](../marks/README.md) owns it (L-6); struck 2026-11-16.
- ~~Threads: legacy or kept, and how they relate to folders and saves.~~ Decided in the threads folder (L-7); struck 2026-11-16.
