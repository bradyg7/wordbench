# R2 · The Shelf: the design round, for review

2026-11-09. The design round for R2 of [debug-spec.md](debug-spec.md) (findings `1d0e`, `3fa7`, `a484`; the person marked it
urgent). **Chosen 2026-11-09: the tree (B)**, question 1 of §7; questions 2 to 9 stand on their recommended answers unless the person says otherwise. **Nothing is built from this yet.** No production code changed; the sheets are `design/r2.py` →
`design/r2.figcraft` and `design/exports/r2/` (all on one board: [all.png](../design/exports/r2/all.png)).

**In one paragraph.** The sheets the person accepted on 2026-11-04 (S1, SH1, SH2) still say what they want, with four
corrections, and two of them are findings the plan did not have: **both apps drop the one field the plan adds to `sets/`**
(tested), and **16 of the 21 items in the person's four real sets are kept panes**, which the window cannot open yet, so
"Open all" is mostly the work of reopening panes, not of a button. The file tree the person asked about is **the same data
drawn differently**, if a folder *is* a set. I recommend the tree (B), built in three steps, with **Open all first**, on
today's list, so `a484` is met before any folder exists.

## 1. The check: do S1, SH1 and SH2 still fit after the Notebook's rework?

The sheets: [S1](../design/exports/phase2b/s1-the-shelf-as-folders.png) ·
[SH1](../design/exports/phase2b/sh1-a-set-close-add-open.png) ·
[SH2](../design/exports/phase2b/sh2-a-set-s-tabs-kept-together.png) (accepted 2026-11-04, "good, plus closing a tab or a
whole set, and adding a tab, document, note and so on"). Against what is built since (W0 to W6, the debug round):

| Part of the sheets | Still fits? | What the rework or a check changed |
|---|---|---|
| Sets in folders (S1) | **Yes, as a picture** | **The storage is wrong.** The plan (tier 6, item 3) says "folders are a new field the Python app passes over". It passes over the field when it *reads*, and drops it when it *writes*: `_write_set` (`study.py:557`) rebuilds the front matter from `name`, `created`, `updated` only. Run on a throwaway folder: a set with `folder: "Phinehas study"` and a `document` item, after the Python app's `remove_from_set` on another item, came back with neither. This app's `write_set` (`store.rs:1472`) does the same. Notes are different (their extra fields survive, checked in W3's desk run); sets are not. So **folders cannot be a front-matter field.** They go in `settings/shelf.json` (§4) |
| Open all (SH1, S1's card) | **Yes, but it is not what the sheet makes it look like** | Clicking a pane item in the Shelf today toasts "pane items open in a later phase" (`panes.ts:984`): that is `a484`, and it is what the person's own sets hit: **16 of their 21 items are panes**, in the Python app's shape (`{type, id, title, params}`): *passage* 3, *entry* (a word) 5, *uses* 3, *interlinear* 2, *search* 2, *help* 1. The window reopens panes from its own keys (`thread\|Phinehas`, `reopen()` in `actions.ts:406`), not from those. Every one of the six types has an opener in the window (`openPassage`, `openStrong`, `openUses`, `openInterlinear`, `openSearch`, `openHelp`), so it is a **translation table** to write and test, and the same table in reverse so that a pane kept from this window can be reopened by the Python app. That table is the real work of `a484` |
| Close all, the set's mark on its tabs (SH2) | **Yes** | The dock has no "which set opened this tab", so a tab needs one, and the tab strip a coloured bar. The core already has `update_set` ("Save where they are now": a set's panes keep what they show now), unused by the window |
| An item's × takes it out (SH1) | **Yes, unchanged** | A set only points at things; × never touches the page, file or thread (the Python app's rule, kept) |
| + Add: this tab, all open tabs, a new note, a note, a place, a thread, a lesson or document (SH1) | **Yes, renamed** | "A new note in the set" is now **a new page** (a note with no place, `notes/_inbox/`; W1). "A note…" is **a page or note**. "A lesson or document…" splits: a lesson, a PDF (both kinds exist), and a **document** (Word file or slides made here: `documents/` records, tier 4, W6), which **has no set kind**: a new `document` kind, with the cost in §4 |
| A page as a tab (SH2 draws "Word study: H7065" as a tab beside the Notebook) | **No, not as drawn** | The Notebook is one pane (`dock.open('notebook', …)`, `notebook.ts:148`); a page is not a tab of its own, so a set holding three pages can open at most one. A thread has its own pane per thread, a document its own preview pane (`doc:<id>`, W6), a place a second reader; **pages are the one kind that cannot be a tab.** This is also R1's ground (what a page is as a window), so R2 should not decide it |
| How it looks | **Redraw** | S1 and SH1 predate the Notebook's sidebar (W1.1). The Shelf's rows should be the sidebar's rows (arrow, icon, name, count), so the two read as one family |
| Pinned, and Pages inside Pages (W3) | **A new overlap** | The Notebook now has a tree and a Pinned list, and the Shelf would have a tree. They do different jobs (B5 draws it): a page *inside* a page is part of it (written in its file, made into its documents); a page *in the Shelf* is a pointer, kept to open together with other things. Pinned stays the Notebook's quick list; it is not retired |

**Verdict: yes, with four changes**: folders are not a field (`settings/shelf.json`), pane items need a two-way translation
before Open all can work, a document needs a kind, and a page cannot be a tab until R1 says so.

## 2. The two designs

Both are on [the board](../design/exports/r2/all.png). Scripture on them (the reader, Strong's) is from the database.

**A · Sets in folders, as accepted, corrected.**
[A1](../design/exports/r2/a1-sets-in-folders-as-accepted-after-the-rework.png) is S1 and SH1 redrawn with the sidebar's
rows and the corrected kinds. Folders hold sets; a set is a card of items with × each, Open all, Close all, + Add. Two
levels of structure (folder → set → item), and a person has to learn which is which.

**B · A file tree, as Obsidian's.** One tree; a folder holds anything: other folders, pages, places, threads, lessons,
documents, kept panes. Folders are what sets were: **a folder is a set**, so "folder" and "set" are one idea and Open all
works on any folder.
[B1](../design/exports/r2/b1-the-shelf-as-a-tree.png) the tree ·
[B2](../design/exports/r2/b2-a-folder-open-all-close-all-and-its-menu.png) a folder's bar and menu (Open all, Open all with
the folders inside, Close all, Add, New folder, Rename F2, Move to…, Remove) ·
[B3](../design/exports/r2/b3-open-all-the-folder-s-tabs-together.png) what Open all does (tabs with the folder's mark, the
reader not moved) ·
[B4](../design/exports/r2/b4-moving-things-and-adding-them.png) dragging onto a folder, + Add ·
[B5](../design/exports/r2/b5-two-trees-two-jobs-the-shelf-and-the-notebook-s-pages.png) the Shelf beside the Notebook's
tree. Unlike a file in Obsidian, an item is a pointer, so one page can sit in two folders (Ctrl+drag) and removing it
from a folder never deletes it.

## 3. The comparison

| | **A · Sets in folders** | **B · A file tree** |
|---|---|---|
| What the person sees | Folder rows, set cards; Open all on a card | One tree in the sidebar's rows; Open all on any folder; drag, F2, Del as in Obsidian |
| Concepts | Folder, set, item | Folder, item |
| Adds to `sets/*.md` | **Nothing in the file format** except the `document` kind. A set file stays exactly as today | **Same**: each folder is an ordinary set file. Creating a folder creates a set file |
| Adds elsewhere | `settings/shelf.json`: folders (name, order) and which set sits in which | `settings/shelf.json`: for each set, its parent folder and order. Fold state is the window's storage, as the Notebook's sections are |
| The Python app sees | Its sets as before; folders do not exist for it | Every folder as a flat set with its own items; nothing hidden except the nesting |
| If the Python app rewrites a set | Loses a `document` item; keeps the folders (in the other file) | Same |
| Names | Set names unique (as now); folder names separate | **Folder names unique across the whole Shelf** (the Python app finds a set by name; two "Notes" folders would be "Which set?") |
| `a484`, open the whole set | Open all on a card | Open all on a folder, the same code (step 1 below) |
| Size of build | **L**, as the spec said: step 1 (M), folders and cards (M), Add menu and documents (S–M) | **L+**, about a third more than A: step 1 (M), the tree (**L**: nested folders, drag to move and reorder, inline rename, keyboard, Find as a filter, ≈ 1.5 × A's folders step), Add menu and documents (S–M) |
| Rough checks to write | A: about 15 desk checks, 6 Rust tests | B: about 25 desk checks, 8 Rust tests |
| Risk | Low | Medium: the drag and the keyboard are where a tree is fiddly; a mistake there moves things in two files (out of one set, into another) |
| Phone | Cards stack; fine | An indented list; **drag becomes Move to…**; Open all hidden (one pane at a time, as the plan's phone rows say) |
| Matches what was asked twice (`3fa7`, now) | In part: "folders" yes, "like Obsidian" no | Yes |

Sizes are my estimates from how earlier tiers went (the tier-6 line was L; W3's tree and drag were one step), not
measurements.

## 4. What it writes to the study folder

**Unchanged:** every `sets/<slug>.md`, in the Python app's format (front matter `name`, `created`, `updated`; one
`- {"key", "kind", …}` line per item). A folder in B is one of these.

**New file, `settings/shelf.json`** (the Python app never reads `settings/shelf.json`; it already ignores
`settings/notebook.json`). B's:

```json
{"folders": {"phinehas-study": {"parent": "", "order": 1},
             "word-study-zeal": {"parent": "phinehas-study", "order": 1},
             "covenant-of-peace": {"parent": "phinehas-study", "order": 2}}}
```

A set not in it sits at the top, in name order; an entry whose set is gone is ignored. So a set made or deleted by the
Python app can never break the tree. A folder's items stay in its own file, in order; folders come before items, as in
Obsidian. **Backup first** (`scripts/backup-study.ps1`, in the person's terminal), as for W3 and W5.

**One new item kind, `document`** (`{"key": "…", "kind": "document", "ref": "<documents/ record id>"}`). Tested: the
Python app does not list it and drops it the next time it rewrites that set. That is the price of having documents in the
Shelf at all, and the only way to avoid it is to leave documents out. Pages need nothing new: a page is already a `note`
item whose `ref` is its id.

**Pane items stay in the Python app's shape** (`{type, id, title, params}`), for the six types the person's sets hold and
that the window can reopen. A pane the window cannot keep that way is refused with the Python app's own words ("That pane
cannot be kept in a set").

**Deleting a folder** goes to `.trash/` (CLAUDE.md), its items are not touched, and the folders inside it move up a level
(the rule W3 made for pages). A pointer to something that is gone shows dimmed ("gone", which `wb set show` already says),
with × to clear it.

## 5. How `a484` is met

The same in both, and it does not wait for folders: **step 1 is Open all and Close all on today's flat Shelf**, with no new
file. Each item opens where its kind goes:

| Kind | Opens as | Note |
|---|---|---|
| pane (the six types) | its own tab, through the translation table | the work of the step |
| thread, lesson | its pane, as now | |
| place | **a second reader**, the reader does not move | Notebook setting *Places open in…* (W4) is for a single click, not for ten at once |
| document | its preview pane (`doc:<id>`, W6) | "Open in Word" stays on the row's menu: Open all must not start Word |
| page | the Notebook, on that page; with several, **the first**, and the window says how many it left | page tabs wait for R1 |
| PDF | where PDFs open today | |

Tabs carry the set's mark (a bar over their tabs, B3) and `Close all` closes exactly those. Nothing is written to a file
by opening or closing. `wb set open <name>` and `wb set close <name>` go through `wb do`, so a terminal can do what the
window does (CLAUDE.md's rule); the translation table is tested in wb-core.

## 6. Recommendation

**Build B, the tree, in three steps, Open all first.**

1. **Open all, Close all, the mark, on today's list** (M). The translation table; the dock tags a tab with its set;
   `document` kind; `wb set open|close`. No file changes except what an item adds. **This alone answers `a484`.**
2. **The tree** (L). `settings/shelf.json`, `wb shelf folder new|rename|move|rm`, the sidebar rows, drag, F2, Find. Backup first.
3. **+ Add and drop onto the Shelf** (S–M): this tab, all open tabs, a new page in a folder, a page, place, thread, lesson,
   document; a pane's tab dragged onto a folder.

Why B over A: it is the picture the person has asked for twice; it has one idea instead of two; it costs the same in
what is written to the files (A and B differ only in the window), and the extra build is all in one place (step 2), so it
can be judged on its own. If the tree turns out heavier than it is worth, steps 1 and 3 stand on today's list and
nothing is lost. A is the choice if the person wants the smallest build that still has folders.

Not part of R2: pages as tabs (R1), the Shelf's own settings such as what Open all does to the tabs already open (`c551`,
R4's Settings), a folder that fills itself from a view line (possible later, since the Notebook's view language exists).

## 7. Questions for the person

The first three block the build; the rest have an answer I will use unless told otherwise.

1. **The tree (B) or the cards (A)?** Recommended: the tree.
2. **Does "folder" replace "set" in the window?** (`wb set …` keeps its name.) Recommended: yes; the one word is the idea.
3. **Open all and the pages in a folder:** open the first in the Notebook and say how many were left (nothing new to
   build), or wait for page tabs from R1? Recommended: the first, now; tabs after R1.
4. Open all opens **places as second readers** and never moves the reader. OK?
5. **A document opens in the app's preview**, not in Word, from Open all; Word from the row's menu. OK?
6. **The Python app:** it will show nested folders as flat sets, and drop a `document` item if it rewrites that set.
   Acceptable (backup first, as always)? Recommended: yes.
7. **Folder names unique across the Shelf?** Recommended: yes.
8. **Build step 1 first, on its own, as soon as the design is accepted?** Recommended: yes.
9. **Pinned stays in the Notebook** beside the Shelf's tree (B5)? Recommended: yes.

## 8. What was checked, and what was not

- **Checked:** the Python app's write of a set (a throwaway folder, not the study folder: `folder:` and the `document`
  item both gone after `remove_from_set`); the Python and Rust source for set parsing and writing; the person's four real
  sets, **read only**, for what they hold; the window's pane openers and the `reopen` table; that the Notebook is one pane
  and a document preview a pane per document.
- **Not checked:** this app's `write_set` was read, not run, for the same drop; no desk run (nothing is built); the
  sizes in §3 are estimates; the phone is described, not drawn.
- **Out of scope here and left alone:** `docs/debug-spec.md`, `CLAUDE.md`, the study folder.

Files: `design/r2.py` (the script), `design/r2.figcraft`, `design/exports/r2/` (A1, B1 to B5 and the board). To redraw:
`python design/r2.py` (about five seconds; the export folder is emptied first).
