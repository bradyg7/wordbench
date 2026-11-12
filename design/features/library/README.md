# The library: the Notebook, the Shelf, and keeping

**State:** exploring · **Sheets:** `python design/features/library/library.py` writes `library.figcraft` and
`library.pdf` (the board, one vector page) · Nothing here is built yet.

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

## Open questions

- Round 1: is "Keep" the right word (vs Bookmark, Save)? Is K the right key?
- Does a page belong in a folder the same way a kept verse does (one tree), or do pages keep their own nesting (pages
  inside pages, as now) with folders only for kept things?
- Can one thing sit in two folders? (Sets today allow it.)
- How does the trail's "Keep as a page" relate: a page, or a kept trail in a folder (S4 shows it as a kept thing)?
- Where do threads go: a thread is a page today; is a thread a kind of folder of places?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-11 | S1-S6 | Keep a verse in one step with a toast (S1), the folder picker (S2), the library drawer with pages, folders and the Shelf (S3), a folder opened as cards with Open all as tabs (S4), the same bookmark everywhere (S5), kept is not open (S6) | Round 1 review below |
| 2 | 2026-11-11 | S7-S14 | Save opens the picker at once, several folders by ticking, Just the Shelf, Esc keeps it unfiled (S7); saves in the reader margin: whole verse, phrase, several on a line, never coloring text (S8); what + adds (S9); a big folder opened as a list, open only what you tick, more than 10 asks (S10); one save in several folders (S11); the three views: Shelf as the bookmark manager (S12), Folders (S13), Notebook (S14) | Round 2 review below |
| 3 | 2026-11-11 | S15-S24 | The picker with dozens of nested folders (S15); saves in the left margin and your pages in the right margin (S16); 30 saves on one verse, grouped by folder (S17); "What is open now" with ten tabs (S18); reaching a folder by clicking it, Cards with folders (S19); four pieces defined, the Shelf folded into Unsorted (S20); one library search (S21); cards: click, drag, menu (S22); the page editor and New page (S23); the Library in a narrow column (S24) | Round 3 review below |

## Data the sheets show

Scripture and the H7065 entry come from `design/content.json` (generated from the database by `design/content.py`),
read through `build.C`. Nothing is typed by hand.

## What the build must satisfy

Not written yet: the person has not accepted a direction.

## Out of scope / later

- The trail and the rail: [minimize](../minimize/README.md). The Concordance's bookmark marks: [concordance](../concordance/README.md).

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

## Open after round 3

- The name for saves in no folder: Shelf or Unsorted (or another word).
- How pages that refer to a verse show beside the text (S16's right margin).
- Threads: legacy or kept, and how they relate to folders and saves (threads folder).
