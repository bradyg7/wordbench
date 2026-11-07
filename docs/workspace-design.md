# The Notebook as a workspace: the design round (W2), for review

2026-11-07. The sheets for W2 of the plan "The Notebook as a workspace" (a Claude doc, shared from claude.ai). W0 and W1
are built ([phase2-results.md](phase2-results.md) sections 19 and 20). Nothing on these sheets is built yet: the person
accepts or changes each, and then W3 to W6 are built from what is accepted. Tier 4 (documents from a thread) comes
first after the review, as decided.

**How they are made:** `python design/workspace.py` → `design/workspace.figcraft` (one page, *Workspace*) and
`design/exports/workspace/`, in about 10 seconds. It reuses `design/phase2b.py`'s and `design/build.py`'s helpers, so
the sheets look like the phase 2b round. Scripture on them comes from `design/content.json` (fetched from the
database); everything else is demo writing about the Phinehas demo. The app uses Literata for scripture; the sheets
use Merriweather, FigCraft's built-in serif.

**Every window on one board:** [all.png](../design/exports/workspace/all.png).

## The decisions they are drawn with (the person's, 2026-11-07)

| Question | Answer |
|---|---|
| What a note with no place becomes | **A page**, listed under Pages; the Inbox is retired (built in W1) |
| How a page is edited | **Block by block**: a click edits one block's Markdown |
| The design round | **Reviewed before W3 to W6** are built |
| Documents from a thread (tier 4) | **Right after the review**, before pages and blocks |

## The windows

| Window | What it answers | For the person to decide |
|---|---|---|
| [W1 · The sidebar: pages inside pages](../design/exports/workspace/w1-the-sidebar-pages-inside-pages.png) | The Notebook expanded beside the reader: Today, Pinned, Pages as a tree, At the reader, Threads, Questions; Templates and the Trash at the foot. A page shows its path, title, places and threads, blocks, the pages inside it and Linked from | Whether the sidebar replaces W1's row of sections when the Notebook is wide, and the row stays when it is narrow (proposed) |
| [W2 · Writing in blocks, and the / menu](../design/exports/workspace/w2-writing-in-blocks-and-the-menu.png) | One block edited at a time, as its Markdown; a grip to drag; `/` opens the block menu, narrowed by typing | Which blocks the menu offers (drawn: Scripture, Heading, List, To-do, Quote, Divider, Table, Link to a page, Page inside this one, View) |
| [W3 · Scripture blocks](../design/exports/workspace/w3-scripture-blocks.png) | A passage drawn from the Bible with the person's marks; YLT; Open in the reader (and back). The file holds only the reference | The fenced form in the file (proposed: ` ```scripture ` then `Num 25:10-13`) |
| [W4 · A view](../design/exports/workspace/w4-a-view-a-list-kept-up-to-date.png) | One line of the command language, listed live: `notebook @Num 25 questions` | The view language: the command language's `@place` and the Notebook's sections (pages, questions, a thread, days) |
| [W5a · A verse from a note: opens under its link](../design/exports/workspace/w5a-a-verse-from-a-note-opens-under-its-link.png) | Finding `94a1`, first way: the verse alone, under the line, with Interlinear, Strong's and Definitions as tabs | **Pick one of W5a, W5b, W5c** (or a mix) |
| [W5b · its own pane](../design/exports/workspace/w5b-a-verse-from-a-note-its-own-pane.png) | Second way: a pane of its own with the verse, every original word, and a word's Strong's entry | |
| [W5c · a card, then a step at a time](../design/exports/workspace/w5c-a-verse-from-a-note-a-card-then-a-step-at-a-time.png) | Third way: a small card with the verse and three buttons; the card can be pinned as a pane | |
| [W6 · A new page from a template](../design/exports/workspace/w6-a-new-page-from-a-template.png) | Templates are the person's own pages under Templates; `{place}` filled with the place picked | Whether to start with no templates at all (proposed), or with empty ones named Chapter study, Word study, Lesson outline |
| [W7 · A page made into a document](../design/exports/workspace/w7-a-page-made-into-a-document.png) | Make a Speaker Script from a page: its headings are the outline, its scripture blocks the verses; every verse checked after it is made | Nothing new: built on tier 4's renderer |

Definitions (W5) stay blank until tier 7's dictionary is chosen; the sheets leave that tab empty on purpose.

## What it would change in the study folder

All of it in files the Python app reads or passes over, as the rules require:

- **New front-matter fields** on notes: `parent` (the page it is inside), `order`, `pinned`. Notes stay where they are.
- **Two fenced blocks** in a note's body: ` ```scripture ` (a reference) and ` ```view ` (one command line). No
  scripture text is ever written into a file.
- **Templates** as notes on a page called Templates (a `template: true` field), so they are ordinary files.
- Documents from a page go to `documents/` in the Python app's format, as tier 4's from a thread.

`scripts/backup-study.ps1` runs before the first of these reaches the real folder.
