# Threads

**State:** exploring (round 2 drawn 2026-11-16, for the person's look) · **Sheets:** `python design/features/threads/threads.py` writes `threads.figcraft` and
`threads.pdf` (the board, one vector page) · Nothing here is built yet. What other tools get wrong, and so what this
folder avoids: [bible-software-complaints](../../research/bible-software-complaints.md) (theme 9: flat lists of saved
things; theme 8: the place lost on the way back).

**Readiness: likely finished** (2026-11-16, the Notebook pass, by [ready-criteria](../ready-criteria.md); never
"accepted", which only the person says). Inferences first: TH-1 (direction A, from the person's words of 2026-11-11
and 2026-11-12) and TH-2 to TH-10. TH-1 changes the thread model `AGENTS.md` names, so it is also "Needs the person"
1, as check 1's revision requires; nothing is built before that answer.

- **1** A chosen (TH-1); B and C superseded, off the board (the board shows T1, T2, T7-T11 only, read from
  `threads.figcraft`).
- **2** the questions left are the person's: the thread model (1) and moving thread files (2), each with a
  recommendation.
- **3** T8-T11 drawn; T10's sheet reaches the bottom edge (looked at on the rendered board).
- **4** every line names inputs and a result; "The reader's place is kept" is its own line.
- **5** `wb thread …` kept; `wb folder color`, `wb folder shown`, `wb shelf` listing thread files named as required.
- **6** [overlaps](../overlaps.md) "Layers, eyes and what can be hidden" and "What an underline means" resolved
  (TH-1, TH-5, TH-7, marks MK-1); [coverage](../coverage.md)'s Threads row reads TH-1.
- **7** the only clash with `AGENTS.md` is the wording TH-1 asks the person to change ("Needs the person" 1); TH-3
  keeps every `wb thread` contract and the ```` ```thread ```` fence.
- **8** fixed on this pass: TH-7 and two build lines said a whole saved verse is underlined, but T1 and T7 (and
  library S8, marks M15) draw it as a margin mark with the words untouched; the README now says what the sheets draw.
  Scripture through `build.C` from `design/content.json` (generated); the phrase is cut by word position.
- **9** nothing suggested. **10** no file moves (TH-2); eyes in `settings/`; the move is "Needs the person" 2.

For the person, to accept: answer "Needs the person" 1, then look at T1 (shown on the text), T2 (the folder), T7
(saving), then T8-T11.

Threads "will likely become consumed by the folder feature" (the person, library round 1 review, 2026-11-11). This
folder decides what a thread is beside the pieces the library fixed (Page, Folder, Save, Margin note, Library:
[library](../library/README.md) S20). It touches the reader's underlines, the thread page (`thread:<slug>`,
`crates/wb-core/src/threadpage.rs`), `wb thread …`, the Save picker and the reader's one marks panel.

## Leading design (2026-11-16)

| Part | Leading | Superseded (and by what) |
|---|---|---|
| A thread is a folder with a color | T1 (shown on the text), T2 (the folder opened), T7 (saving into it) | T3, T4 (B: a page with a Places block) and T5, T6 (C: a layer on the text), by TH-1; their drawings are in git history (`b875cd4`) |
| The real conditions | T8 (among other tabs), T9 (floating), T10 (narrow), T11 (years of study) | |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 4c02 (2026-11-08) | Collapse all threads in the Notebook |
| d84d (2026-11-09) | A thread's verses do not show in its page; is the Threads tab still needed? |
| 38c2 (2026-11-08) | Everything a page, even notes in threads |
| 7d00 (2026-11-08) | Threads, questions and notes as block options in a page |
| d0d0 (2026-11-12) | The tick can also add to a page, not only a thread |
| c9c3 (2026-11-12) | The tick can also copy |
| b99f (2026-11-10), ad4c (2026-11-11) | Highlight colors per topic, highlights layered by year and toggled "kind of like how thread highlights are toggleable" |
| 64f0 (2026-11-10) | Continuity of what can be shown and hidden on the text |

## What a thread is today

- A file, `threads/<slug>.md`: name, color, a note, and an ordered list of places (`<!-- anchors -->`).
- Shown as a page (R1): its note is the page's text; notes written on it are the pages under it.
- Its color underlines its verses in the reader; each thread can be shown or hidden.
- On 2026-11-12 the real folder held 9 threads, from 0 to 59 places each.

## What the person has said

- 2026-11-11 (library round 1 review): "Threads will likely be consumed by folders"; a deeper round decides whether
  threads are a legacy idea and where they fit.
- 2026-11-12 ([marks](../marks/README.md), answer 5): "A thread is a folder of saves" (leaning). Then what does an
  underline mean? Give a system people can understand that does not fight their own way of organizing.
- d84d: the separate Threads tab "just seems like legacy stuff"; a thread's verses should show where the thread is.

The person has not reviewed round 1's sheets. The decisions below are the overseer's, from these words.

## Decisions (2026-11-16)

Each is **decided by overseer from existing decisions (inference)**, dated 2026-11-16, and rests on the lines named.

| # | Decision | Rests on |
|---|---|---|
| TH-1 | **A thread is a folder with a color** (direction A). Its places are the saves in the folder, in the folder's own order; its note is a page in the folder; pages written on it are pages in the folder. B (a page that also sorts) breaks library S20's line, which the person set; C (a layer with no pages and no nesting) loses the thread's note and pages. Both are superseded. **This changes the thread model `AGENTS.md` names, so it is also under "Needs the person".** | The person, 2026-11-11 and 2026-11-12; library S20 (the person's line, round 3 review) |
| TH-2 | **No file moves to build it.** `threads/<slug>.md` stays where it is and is read as a folder with a color (T2). Moving threads into the folders' own file form is a separate, one-time move (below, "Needs the person"). | `AGENTS.md` ("what the person already wrote must never be lost"; a move is designed first and needs the go-ahead) |
| TH-3 | **The window's word is "folder"; "thread" leaves the window.** The Notebook's Threads group and tab go (d84d); a folder with a color sits in FOLDERS with its dot (library S25). `wb thread …` keeps every contract and works on folders with a color; `thread:<slug>` still opens it; a ```` ```thread ```` fence in a page keeps working and shows the folder's saves. | d84d; `AGENTS.md` ("Preserve established `wb` command contracts") |
| TH-4 | **A color can mark a phrase, not only a verse.** A save can be a verse, a phrase or a word (library S8), and a thread's places already take a run of words (`wb thread rm`: "a verse, a run, or H7065"). How the line looks is [marks](../marks/README.md) M13 and M15. | library S8 (liked); marks M15 |
| TH-5 | **Each folder with a color has an eye**, listed in the reader's one marks panel as "Shown on the text" (T1, T10, T11). A thread is not a layer: layers by year and by color are [highlights](../highlights/README.md)' own question and are not decided here. | reader R7 (decided: one panel shows or hides every kind of mark); 64f0 |
| TH-6 | **At most two lines under a run.** A run saved in more shown folders still draws two; the hover names every folder (T11). | marks M15 |
| TH-7 | **What shows on the text:** in a folder that has a color and whose eye is on, a save of a phrase or a word draws the line under it (marks M15); a whole verse saved shows the folder's color in its mark in the left margin, and its words are never underlined or colored (library S8; marks M15: "lines are for phrases"). A page, a search, a sitting or a document saved in the same folder draws nothing. A folder inside a colored folder has its own color or none; color is not inherited. (Corrected 2026-11-16 to what T1 and T7 draw.) | library L-2 (folders nest), S8, S20; marks M15 |
| TH-8 | **Saving into a colored folder is the library's Save** (K, the picker, S7); the only thing a color adds is the line on the text (T7). Search's tick ("add to a thread") becomes Save into folders; adding the ticked verses to a page and copying them (d0d0, c9c3) are [search](../search/README.md)'s results bar, not designed here. | library L-1, S7; overlaps "Save's mark" |
| TH-9 | **Collapse (4c02):** FOLDERS folds as every group of the side list does (library S25). | library S25 |
| TH-10 | **Years of study:** the panel lists the shown folders first, the rest folded under their parent folder with counts, with a search field and Hide all; a folder with hundreds of saves shows its first 20 in its own order and "Show all N" (T11). | index, "Every design is drawn in the real conditions" |

## Needs the person

These change the thread model or move the person's files. Each has the overseer's recommendation; the design is drawn
for the recommended answer, and nothing that depends on them is built before the answer.

1. **Is a thread a folder with a color (TH-1)?** Recommended: yes. Reasons: it is what the person leaned to twice; it
   keeps one way to sort (S20) and puts a thread's verses where the thread is (d84d); nothing the person wrote is lost
   or moved (TH-2). Main risk: a folder's order is the person's own, and a long folder that is also underlined makes
   the eye matter more (T11 draws it). If the answer is yes, the `AGENTS.md` lines "a thread is its
   `threads/<slug>.md` read as a page" and "a thread … put in a page is a ```` ```thread ```` … fence" need the
   person's rewording ("read as a folder"); the overseer does not edit `AGENTS.md`.
2. **Moving thread files into the folders' form, once.** Recommended: not now. Build TH-1 by reading the files where
   they are. When [library](../library/README.md)'s folder format is settled (its open question 2), design the move
   there: read the old form, try it on a scratch copy, hashed backup (`scripts/backup-study.ps1`), the person's
   go-ahead. The design is complete without it: T1-T11 need no file to move.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-11 | T1-T6 | A: a colored folder shown on the text (T1), the folder opened (T2); B: a page with a Places block (T3), saving into a thread page (T4); C: layers on the text (T5), where each piece sits (T6) | Not reviewed by the person. A chosen by the overseer (TH-1, 2026-11-16) from the person's words of 2026-11-11 and 2026-11-12 |
| 2 | 2026-11-16 | T1, T2 redrawn; T7-T11 | A alone: the library's side list, saving into a colored folder, and the real conditions | For the person's look |

## Data the sheets show

Scripture is Numbers 25 from `design/content.json` (generated from the database by `design/content.py`), read through
`build.C`; the phrase under two lines is cut from the verse by word position (`phrase_idx`, asserted inside the verse).
The saves in T2, T8 and T9 are the first anchors of `threads/phinehas.md` (references only; no verse text); T11's
references are generated. Folder names and counts are a drawn sample.

## The real conditions

| Condition | Window |
|---|---|
| Among other tabs | T8 (the folder as one tab of four beside the reader, which has two tabs) |
| Floating | T9 (a 320 px floating pane beside the underlined verses) |
| Narrow | T10 (a 390 px phone: Shown on the text as a sheet over the bottom) |
| Years of study | T11 (34 folders with a color, 6 shown; one run in five folders; a folder of 412 saves) |

## What the build must satisfy

Not to be built until the person answers "Needs the person" 1. Each line is checked in a Rust test or in the desk
check, on a generated scratch study (never the real folder).

- [ ] **A thread file is read as a folder.** Given `threads/phinehas.md` with a color, a note and 56 places, the
  Library's FOLDERS lists "Phinehas" with its color dot and the count 56; opening it lists the 56 saves in the file's
  order and one page holding the note (T1, T2). No file in the study folder is written by opening it (compare hashes
  before and after).
- [ ] **No Threads group or tab.** The Notebook's side list has no group, tab or filter named Threads; the word
  "thread" appears nowhere in the window except in Help's account of the change (T1).
- [ ] **The line on the text.** With the folder's eye on, every phrase or word saved in it is underlined in its
  color in the reader, one joined line under a run (marks M13), and every whole verse saved in it has a mark in the
  left margin in that color with its words not underlined; with the eye off, neither shows. A page or a search saved
  in the folder draws nothing (T1, TH-7).
- [ ] **Two lines at most.** A run saved in five shown folders draws two lines; hovering it lists all five folder
  names (T11).
- [ ] **Saving.** K on Numbers 25:12, ticking a folder with a color, shows the folder's color in the verse's margin
  mark at once without reopening the chapter; unticking removes it; Esc leaves the save on the Shelf with no color (T7).
- [ ] **The eyes.** "Shown on the text" lists every folder with a color, the shown ones first; an eye turned off stays
  off after the app restarts; Hide all turns every eye off in one action and one Undo puts them back (T1, T11).
- [ ] **Order.** Dragging a save in the folder changes the order in the file as `wb thread move` does; the line on the
  text does not change.
- [ ] **Among other tabs, floating, narrow.** The folder as one tab of four keeps its head (name, dot, eye, counts) on
  one line at 500 px; floated at 320 px its rows end with an ellipsis and the eye and count stay whole; at 390 px
  Shown on the text is a sheet reaching the bottom edge with rows at least 44 px high (T8, T9, T10).
- [ ] **Years of study.** With a generated study of 140 folders (34 with a color) and one folder of 412 saves, the
  panel opens showing only the shown folders and the folded parents with counts; the folder shows its first 20 saves
  and "Show all 412"; opening Numbers 25 with every eye on stays inside the reader's speed budget in
  `npm run measure` (T11).
- [ ] **The reader's place is kept.** From Numbers 25:11 in the reader, hovering the line, opening the folder from the
  hover, opening the save "Joshua 22:13" in it and going back returns the reader to Numbers 25:11 at the same scroll
  position, with the same selection.
- [ ] **Commands.** Existing and kept: `wb thread list | show | page | new | add | add-many | from-search | from-uses |
  move | sort | order | rm | edit | delete | notes | write | pin | unpin`, `wb marks`. Required
  and missing today: `wb folder color <folder> <color | none>` (today only `wb thread edit --color`),
  `wb folder shown <folder> on | off` and `wb folder shown --none` (the eyes; today they are kept only by the window),
  and `wb shelf` listing thread files as folders with their color. `wb folder …` is library's family (its build list).
- [ ] **The study files.** Nothing is written to `threads/` except what `wb thread …` writes today; the eyes are kept
  in `settings/` (not in the thread's file).

## Out of scope / later

- Save, folders, the picker, the side list, the Library's search: [library](../library/README.md). The line's look,
  the pencil and the margin: [marks](../marks/README.md). Layers by year and color, and a quiet Reading mode:
  [highlights](../highlights/README.md). The rail and the trail: [minimize](../minimize/README.md).
- The phone's bottom tab bar (`design/parts.py` `tab_bar`) still names a Threads tab and an Inbox badge; the phone is
  deferred until the desktop is finished (coverage), and T10 does not draw the bar.

## Overlaps

[overlaps.md](../overlaps.md): "Layers, eyes and what can be hidden", "What an underline means", "Save's mark".
