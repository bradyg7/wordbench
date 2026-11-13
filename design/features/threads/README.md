# Threads

**State:** exploring · **Sheets:** `python design/features/threads/threads.py` writes `threads.figcraft` and
`threads.pdf` (the board, one vector page) · Nothing here is built yet.

Threads "will likely become consumed by the folder feature" (the person, library round 1 review, 2026-11-11). This
round decides whether a thread is a legacy idea that folders take over, or keeps a role of its own beside the four
pieces the library rounds fixed (library S20: Page = something you write, Folder = a place you sort into, Save = a
pointer in any number of folders, Library = one tree and one search). It touches the reader's thread underlines, the
thread page (`thread:<slug>`, `crates/wb-core/src/threadpage.rs`), `wb thread …`, the Save picker and the rail.

## Leading design (2026-11-12)

Not yet reviewed far enough to supersede anything: every window still leads its part.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| A: folders take threads over (the person leans this way, 2026-11-12) | T1, T2 |  |
| B: a page with a Places block | T3, T4 |  |
| C: a layer on the text | T5, T6 |  |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 4c02 (2026-11-08) | Collapse all threads in the Notebook |
| d84d (2026-11-09) | A thread's verses do not show in its page; is the Threads tab still needed? |
| 38c2 (2026-11-08) | Everything a page, even notes in threads |
| 7d00 (2026-11-08) | Threads, questions and notes as block options in a page |
| d0d0 (2026-11-12) | The tick can also add to a page, not only a thread |
| c9c3 (2026-11-12) | The tick can also copy |

## What a thread is today

- A file, `threads/<slug>.md`, in the Python app's format: name, color, a note, and an ordered list of places
  (`<!-- anchors -->`). Both apps rewrite it from a fixed model, so no field can be added to it.
- Shown as a page (R1): its note is the page's text; notes written on it are the pages under it.
- Its color underlines its verses in the reader; each thread can be shown or hidden.
- The real folder has 9 threads, from 0 to 59 places each.

## The person's findings about threads (read only)

- f_20261109030509_d84d: a thread's verses do not show in its page, only notes; the separate Threads tab "just seems
  like legacy stuff"; threads should appear as pages with their features inside them.
- f_20261108005015_38c2, f_20261108005120_7d00: everything a page; threads as a block option inside a page.
- f_20261108030719_4c02: minimize all threads in the Notebook.
- f_20261110150750_b99f, f_20261111143730_ad4c: highlight colors kept per topic, highlights layered by year and toggled
  "kind of like how thread highlights are toggleable".
- f_20261110201625_64f0: continuity of what can be shown and hidden on the text.

## Decisions (the person)

None yet.

## Proposed in round 1 (waiting for review)

- **A · Folders take threads over** (T1, T2). A folder may carry a color and be shown on the text; every verse saved in
  it is underlined. The thread's places are the folder's saves (in order); its note is a page in the folder. The file
  stays and is read as the folder.
- **B · A thread stays a page with a Places block** (T3, T4). The page shows its verses (d84d); Save lists thread pages
  beside folders; the page's color underlines its places. Strains S20: a page that also sorts.
- **C · A thread becomes a layer on the text** (T5, T6). Layers (threads, highlight colors, a year of reading) are
  turned on and off over the text; the Highlights rail button becomes Layers. Folders sort, layers mark; a layer has no
  pages and no nesting.

## Open questions (round 1)

- A, B or C, or a mix (for example A's folder with C's on-and-off panel)?
- If threads go, does the word "thread" go too, and `wb thread` with it (kept as an alias for the Python files)?
- Can a color on the text mark a phrase, not only a whole verse (today threads are verse places)?
- Should highlights by color and by year (b99f, ad4c) be designed here or in a highlights folder?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-11 | T1-T6 | A: a colored folder shown on the text (T1), the folder opened (T2); B: a page with a Places block (T3), saving into a thread page (T4); C: layers on the text (T5), where each piece sits (T6) | Waiting |

## Data the sheets show

Scripture is Numbers 25 from `design/content.json` (generated from the database by `design/content.py`), read through
`build.C`. The place references in T2 and T3 are the first anchors of `threads/phinehas.md` (references only; no verse
text). Thread names are the person's own.

## What the build must satisfy

Not written yet: the person has not accepted a direction.

## Out of scope / later

- Save, folders, the picker, the Library: [library](../library/README.md). The rail and the trail:
  [minimize](../minimize/README.md).

## From marks (2026-11-12)

The person leans toward a thread being a folder of saves. That frees the underline; [marks](../marks/README.md)
M5 draws three meanings for it (a pencil line, a saved phrase, your own styles).
