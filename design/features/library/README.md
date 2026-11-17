# The library: the Notebook, the Shelf, and keeping

**State:** exploring · **Sheets:** `python design/features/library/library.py` writes `library.figcraft` and
`library.pdf` (the board, one vector page) · Nothing here is built yet. What other tools get wrong, and so what this folder avoids:
[bible-software-complaints](../../research/bible-software-complaints.md).

**Readiness: unfinished** (2026-11-16, second pass, by [ready-criteria](../ready-criteria.md); never "accepted", which is the person's word). Every check was re-read against `library.py` and the board (`library.pdf`), not taken from the builder. Five checks fail; four of them wait on the person. Re-read on the fourth pass (2026-11-16): nothing in the folder changed since, round 4 is still unreviewed, the cited lines still stand, and the block is still true.

- **1, direction chosen: fails. Needs the person.** Round 4 (S25-S32) proposes a new shape for the Notebook and is not reviewed (Rounds table, "Waiting"); S33-S36 draw that unreviewed round in the real conditions.
- **2, open questions: fails. Needs the person.** Questions 1-4 below are format questions, rightly the person's, each with a recommendation; they do not fail the check. Question 5 (threads) waits on the [threads](../threads/README.md) folder, and question 6 (L-5, the word Shelf) is an inference on a point the person left undecided in the Round 3 review. Neither can be answered from a dated decision.
- **4, what the build must satisfy: fails.** The list covers rounds 1-3 only. It has no line for round 4 (the side list, the menus, the filter line, the title field, columns, many pages) and none that the real conditions are checked in the app. The overseer writes these once round 4 is reviewed; writing them sooner would fix what the person has not seen.
- **5, commands: fails.** Round 4 draws actions with no command named: Duplicate, Copy link, Open beside the reader (S26, `library.py:1053`), Full width, Small text, Page history (S31, `:1139-1149`), the filter line's Kind, Thread, Has a question, Edited and its two sorts (S27, `:1067`), Move to and Pin for several pages (S32, `:1151-1153`). The overseer names them after the review, with check 4.
- **6, overlaps: fails. Needs the person.** [overlaps](../overlaps.md) still has open: margin notes as a fifth kind beside S20's four, Today's page, templates, saved lists, and (added on this pass) choosing and deleting several pages, which S32 draws and [trash](../trash/README.md), an accepted folder, still holds as its own open question (T3).

Passing, with the evidence read on this pass:

- **3** all four are drawn and on the board: floating S33 (`:1215`), among ten tabs S34 (`:1245`; S18 `:664` for rounds 1-3), narrow S35 (`:1286`; S24 `:867`), years of study S36 (`:1319`, 412 pages, forty loose; S15, S17, S10 for rounds 1-3).
- **7** S27 has no chips and no Place: its filter is one line of plain text and a menu headed "search's own" with Kind, Thread, Has a question, Edited and two sorts (seen on the board; `side_list` `:919`), and a page's properties are Thread and Edited. S32's Delete "goes to the Trash with one Undo for all" (`:1153`), which keeps the 7 days of `AGENTS.md` and trash's accepted T1. Notebook settings move to the Notebook tab that [settings](../settings/README.md) already has.
- **8** the board's text has no "Keep", "Kept", "Unsorted" or "Unfiled"; the dropped windows (S1-S4, S12, S14, S16; `DROP`, `:1335`) are not on it. Save / Saved: `save_button` (`:73`), S5 (`:182`), S6 (`:208`), "THE SHELF · SAVED, NOT YET FILED". The Shelf: S20 (`:734`), S21 (`:776`), S23. Scripture is read from `design/content.json`; the three phrases in the script (`:558-559`) are asserted inside Numbers 25:11 and 25:13 (`:563-565`), as S8's is (`:322`).
- **9** the captions of every leading window were read (S5-S24, `:182-867`; S25-S36 on the board) and the board's text searched: no suggestion, related word, recommendation or commentary. The page text on S28-S36 is a sample of the person's own writing, not the app's.
- **10** the four format changes are listed as the person's (Open questions 1-4), with the scratch copy, hashed backup and go-ahead named.

Small things a builder can do alone, none failing a check: S23 says a new page is "on the Shelf" (`:825`) while S20 keeps the Shelf for saves and S36 calls pages in no folder "loose"; the three phrases could be cut from the verse by word position instead of written in the script.

The Notebook and the Shelf "conceptually don't have to be separate": folders and pages working together, and a
bookmark that is "almost second nature ... a one or at most two step process, especially to retrieve it" (the person,
findings f_20261111150806_c43b, f_20261111002622_9413, f_20261108005250_1d0e; review of 2026-11-11). It touches the
Notebook drawer, the Shelf and its sets, every place something can be kept, and the minimize rounds' rail and trail.

## Leading design (2026-11-12)

The board and its PDF hold only these windows. Superseded ones are left off the board by the script's `DROP` list (see [lead.py](../lead.py)); their drawings are in git history (commit `0d59600`).

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Saving | S7 (the picker at once), S5 (the same mark everywhere), S11, S15 | S1, S2 (by S7) |
| How saves show | S8, S17 | S16 (its right margin, by marks M25-M26) |
| Folders and what is open | S6, S9, S10, S13, S18, S19, S22 | S4 (by S10, S19, S22) |
| The Library | S20 (four pieces), S21 (one search), S23 (the page editor), S24 (narrow) | S3 (by S20, S24), S12, S14 (unclear in review; by S20) |
| The Notebook like Notion (round 4, not reviewed) | S25 (side list), S26 (right-click menu), S27 (one filter line), S28 (the page), S29 (/ and the selection bar), S30 (side by side), S31 (the page's … menu; Notebook settings to Settings), S32 (many pages at once) | — |

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

## Proposed in round 1 (waiting for review)

- **Keep is one step on anything that can be opened** (a verse, a word, a Concordance entry or place, a search, a page,
  a document, a trail): the bookmark, or K. It lands on the Shelf at once, with Undo.
- **A folder is the optional second step** (Put in a folder…, or K twice): a small picker with the folders used last.
- **A folder holds pages and kept things alike.** It is today's Shelf set under a new name, so the file and its format
  stay as they are (`wb set …`); the Shelf is what is kept but in no folder.
- **Kept is not open.** Keeping is the library, tabs are the desk. Closing a tab never unkeeps it; taking a thing out
  of a folder never closes its tab (finding 9413). Open all as tabs brings a folder back to the desk.
- **A kept verse shows a ribbon at its number** in the reader.

## Decisions (2026-11-16)

Each is decided by overseer from existing decisions, dated 2026-11-16, and rests on the lines named. Not decided here: the rest of round 4 (S25, S26, S28-S30, S32), which stays unreviewed.

| # | Decision | Rests on |
|---|---|---|
| L-1 | The word is Save and the key is K. | Round 1 review |
| L-2 | One tree: folders hold pages and saves and nest; pages nest in pages as parts of one writing. | Round 1 review; Round 3 review (S20) |
| L-3 | One thing can sit in several folders, or none. | Round 1 review (S5, S11); Round 3 review |
| L-4 | A sitting can be saved as its own object in a folder. "Keep as a page" stays a separate action, as built. Clicking an old trail shows the trail (bc07, a bug against [minimize](../minimize/README.md)'s accepted line). | Round 1 review ("a kept trail is its own object"); minimize |
| L-5 | **An inference, not stated by the person:** saves in no folder are called the Shelf, not Unsorted. The person was not convinced by the change, S7 (liked) says "Just the Shelf", and the rail and `wb shelf` already use the word. | Round 3 review; S7; minimize |
| L-6 | The right margin belongs to [marks](../marks/README.md) (M25-M26); S16's right margin is closed here. | Leading design table |
| L-7 | Threads are decided in the [threads](../threads/README.md) folder; nothing is decided here. | Round 3 review |
| L-8 | Notebook settings move to Settings (S31) with the four kept settings. The Filters form and the tab row become one filter line, and the filters must be [search](../search/README.md)'s, not a second set. S27's chips conflict with marks M8 ("chips as filters are not liked"), so S27 is to be redrawn without chips. | [settings](../settings/README.md); [overlaps](../overlaps.md); marks round-1 review |

L-5 can be reversed with a word from the person.

## Open questions for the person (not decided; the overseer's recommendation beside each)

These touch file formats or other folders, so none is applied. Nothing that touches a file format is built until they are answered, and any move of the person's files is designed first, tried on a scratch copy, after a hashed backup, with the person's go-ahead.

1. **A title field (S28, 9b88).** Recommended: `title:` in the page's front matter, with the first line read as the title where the field is absent. `[[title]]` links resolve through the title today (`crates/wb-core/src/pages.rs`), so the reader must take the field first. Existing files move once.
2. **Pages in folders (S25).** Recommended: keep membership in the folder's set file and do not move page files into directories. A thing may sit in several folders (L-3), which directories cannot express. Nested folders then need a parent field in the set file, which is a format addition.
3. **Columns (S30).** Recommended: comment markers in the Markdown, as threads already use `<!-- anchors -->`, so the file reads top to bottom anywhere and stacks when narrow (6659).
4. **A saved sitting (L-4)** adds a kind of set item pointing into `history/`: a format addition, to approve.
5. **Threads as folders of saves:** the person leans that way; it is theirs to decide in the threads folder.
6. **L-5 (the Shelf)** is an inference on a point the person left open; confirm or reverse it.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-11 | S1-S6 | Keep a verse in one step with a toast (S1), the folder picker (S2), the library drawer with pages, folders and the Shelf (S3), a folder opened as cards with Open all as tabs (S4), the same bookmark everywhere (S5), kept is not open (S6) | Round 1 review below |
| 2 | 2026-11-11 | S7-S14 | Save opens the picker at once, several folders by ticking, Just the Shelf, Esc keeps it unfiled (S7); saves in the reader margin: whole verse, phrase, several on a line, never coloring text (S8); what + adds (S9); a big folder opened as a list, open only what you tick, more than 10 asks (S10); one save in several folders (S11); the three views: Shelf as the bookmark manager (S12), Folders (S13), Notebook (S14) | Round 2 review below |
| 3 | 2026-11-11 | S15-S24 | The picker with dozens of nested folders (S15); saves in the left margin and your pages in the right margin (S16); 30 saves on one verse, grouped by folder (S17); "What is open now" with ten tabs (S18); reaching a folder by clicking it, Cards with folders (S19); four pieces defined, the Shelf folded into Unsorted (S20); one library search (S21); cards: click, drag, menu (S22); the page editor and New page (S23); the Library in a narrow column (S24) | Round 3 review below |
| 4 | 2026-11-16 | S25-S36 | The Notebook like Notion, from the installed build of 16 November: one folding side list with folders above pages and hover-only ⋯/+ (S25); one right-click menu (S26); one filter line of chips instead of the Filters form and the Days/Pages/Places/Threads/Questions/All tabs (S27); the page centred with a title field and properties, plain text lines (S28); / blocks and a selection bar, no top toolbar (S29); blocks side by side at full width (S30); the page's own … menu, Notebook settings moved to Settings (S31); choosing many pages, one Delete (S32); then the real conditions: floating (S33), among ten tabs (S34), narrow (S35), 412 pages with forty loose (S36) | Waiting |

## Data the sheets show

Scripture and the H7065 entry come from `design/content.json` (generated from the database by `design/content.py`),
read through `build.C`. Nothing is typed by hand.

## What the build must satisfy

Not accepted. Rounds 1-3 are liked but not accepted, round 4 is unreviewed (S27 redrawn without chips or Place, 2026-11-16), and threads and the open questions above must be settled first. Only what is decidable now:

- [ ] Save on anything that opens (K) opens the picker at once, with several folders by ticking, Just the Shelf, and Esc leaving it on the Shelf (S7, S15).
- [ ] Saved is not open: closing a tab never unsaves, and removing from a folder never closes (9413).
- [ ] A big folder opens as Cards or List; open only what is ticked; more than 10 asks (S10).
- [ ] One library search over pages, folders and saves, with Questions as a filter of it (S21, marks M8).
- [ ] Return case: opening a save of a verse and going back returns to the Library row it was opened from, and the reader's place is restored.
- [ ] Commands. `wb set` and `wb shelf` keep their contracts. Missing: `wb save <thing> [--folder <f>]...`, `wb folder new|rename|move|list`, a kind filter on `wb find`, and `wb page delete <id>...` for many.
- Nothing that touches a file format is written here until the open questions are answered.

### The real conditions (the person, 2026-11-13)

| Condition | Window |
|---|---|
| Among other tabs | S18 (ten tabs, the Library's menu), S34 (round 4 as one of ten tabs, 3 more listed) |
| As a floating tab | S33 (round 4 as a floating window) |
| Narrow | S24 drawn; S35 (round 4 in a 420px column, the list as a path, opened) |
| Years of study | S15, S17, S10 drawn; S36 (round 4 with 412 pages, forty loose, a filter answering 23 of 412) |

All four are drawn; the round 4 windows (S33-S36) are not reviewed and checked in the app only when built.

Furthest from acceptance of the three folders.

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

## Open after round 3

- ~~The name for saves in no folder: Shelf or Unsorted.~~ Shelf (L-5, an inference; open question 6); struck 2026-11-16.
- ~~How pages that refer to a verse show beside the text (S16's right margin).~~ [marks](../marks/README.md) owns it (L-6); struck 2026-11-16.
- ~~Threads: legacy or kept, and how they relate to folders and saves.~~ Decided in the threads folder (L-7); struck 2026-11-16.
