# The Notebook as a workspace: the design round (W2), for review

2026-11-07. The sheets for W2 of the plan "The Notebook as a workspace" (a Claude doc, shared from claude.ai). W0 and W1
are built ([phase2-results.md](phase2-results.md) sections 19 and 20). Nothing on these sheets is built yet: the person
accepts or changes each, and then W3 to W6 are built from what is accepted. Tier 4 (documents from a thread) comes
first after the review, as decided.

**Second pass, the same day,** after the person's review of the first sheets (their words are quoted under
[The review](#the-review-and-what-changed)). W5c is chosen for the verse from a note; W5a and W5b are gone from the board.

**Accepted, 2026-11-07:** "the review is good, begin tier 4". The second pass stands as drawn. Where a sheet names a
choice (a row per open reader, put-away words kept per verse, the four blanks, to-dos left out of a document), the drawn
one is built unless the person says otherwise. W3 to W6 are built from it after tier 4.

**How they are made:** `python design/workspace.py` → `design/workspace.figcraft` (one page, *Workspace*) and
`design/exports/workspace/`, in about 10 seconds (the export folder is emptied first, so a dropped window leaves no
picture behind). It reuses `design/phase2b.py`'s and `design/build.py`'s helpers, so the sheets look like the phase 2b
round. Scripture on them comes from `design/content.json` (fetched from the database); everything else is demo writing
about the Phinehas demo. The app uses Literata for scripture; the sheets use Merriweather, FigCraft's built-in serif.

**Every window on one board:** [all.png](../design/exports/workspace/all.png).

## The decisions they are drawn with (the person's, 2026-11-07)

| Question | Answer |
|---|---|
| What a note with no place becomes | **A page**, listed under Pages; the Inbox is retired (built in W1) |
| How a page is edited | **Block by block**: a click edits one block's Markdown |
| The design round | **Reviewed before W3 to W6** are built |
| Documents from a thread (tier 4) | **Right after the review**, before pages and blocks |
| A verse opened from a note (finding 94a1) | **W5c, the card**: "THIS SHOULD BE THE IMPLEMENTATION" (the review) |

## The review, and what changed

| Sheet | The person's words | What the second pass does |
|---|---|---|
| W1 | "what is the purpose of the "at the reader"? does it load what pages are attached to the current chapter open in the reader? which reader does it open, especially with open opening a new side reader (so multiple readers can be open)?" | **The answer:** yes. At the reader lists the notes and pages placed in the chapter the reader is showing, and follows it as it moves. It never opens or moves a reader itself. **New, W1.2:** with a second reader open, each reader gets its own row (the reader first, then each second reader), so nothing has to be picked; a row opens that chapter's notes on the page side. Places' Follow the reader switch still follows the reader at the left, as built in W1. |
| W3 | "would be cool if you could have the scripture show in paragraph or line view (one verse per line, very useful in psalm studying). also the open in the reader should have the option of either new reader or current reader." | **Paragraph \| Lines** in each scripture block's head; Lines puts each verse on its own line, and the block keeps the choice (in its fenced block, after the reference). **Open ▾** asks where: in the reader (it moves; Back returns it) or in a new reader (a pane; the reader stays put). |
| Every Open of a place | (from W3 and W5a) | One menu everywhere a place opens from the Notebook: **In the reader** (Click) or **In a new reader** (Ctrl+click). The ticked one is what a plain click does; Notebook settings → *Places open in…* changes it. |
| W4 | (no comment) | Unchanged. |
| W5a | "open the chapter button should have the option of either open in current reader or open in new reader. for the interlinear that pops up, should have the option of minimizing the words that you want visible and the option of bringing them back" | Carried into the card (W5c): **Open the chapter ▾** with the same menu (W5.1); in the card's Interlinear each word has **−** to put it away; the words put away stay as a row of small names in their order, a click brings one back, **Show all** brings every one (W5.2). Which words are put away is kept per verse on this computer, not in the study folder. |
| W5c | "THIS SHOULD BE THE IMPLEMENTATION." | Chosen. W5a and W5b are dropped; the card's pin still keeps it as a pane of its own. |
| W6 | "there should be a way to customize those templates (or if it already is atleast make that explainable in the help section, idk). would liek to see this expanded out." | Three sheets: a new page from a template, with **Edit your templates** (W6.1); **editing a template** like any page, the blanks (`{place}`, `{date}`, `{title}`, `{reader}`) offered on `{`, and the template's own settings (the name new pages get, whether it asks for a place, where they go), and *Save as a template* on any page (W6.2); **a Help entry** for templates, the Templates page, and the `wb` commands (W6.3). |
| W7 | "would like to see more demo of the document creation, would like to see this expanded out." | Four sheets: **what to make** (the Python app's structures, with their own descriptions; tier 4 makes the Speaker Script and Verse by Verse as PDF pages, the rest come in phase 5, greyed) and a theme (W7.1); **what goes in** and what each block becomes (W7.2); **made, and every verse checked** (W7.3); **the page keeps its documents**, with *Make again* when the page has changed since, and a preview (W7.4). |

## The windows

| Window | What it answers | For the person to decide |
|---|---|---|
| [W1.1 · The sidebar: pages inside pages](../design/exports/workspace/w1-1-the-sidebar-pages-inside-pages.png) | The Notebook expanded beside the reader: Today, Pinned, Pages as a tree, At the reader, Threads, Questions; Templates and the Trash at the foot | Whether the sidebar replaces W1's row of sections when the Notebook is wide, and the row stays when it is narrow (proposed) |
| [W1.2 · At the reader, with a second reader open](../design/exports/workspace/w1-2-at-the-reader-with-a-second-reader-open.png) | What At the reader is for; a row per open reader; where a place in a note opens | A row per reader (drawn), or one row that follows the reader last used |
| [W2 · Writing in blocks, and the / menu](../design/exports/workspace/w2-writing-in-blocks-and-the-menu.png) | One block edited at a time, as its Markdown; a grip to drag; `/` opens the block menu | Which blocks the menu offers |
| [W3 · Scripture blocks: a paragraph, or a verse to a line](../design/exports/workspace/w3-scripture-blocks-a-paragraph-or-a-verse-to-a-line.png) | Paragraph \| Lines; YLT; Open ▾ (the reader or a new reader). The file holds only the reference | The fenced form (proposed: ` ```scripture ` then `Num 25:10-13`, then `lines` / `ylt` when chosen); what a plain click on Open does by default (drawn: the reader) |
| [W4 · A view](../design/exports/workspace/w4-a-view-a-list-kept-up-to-date.png) | One line of the command language, listed live: `notebook @Num 25 questions` | The view language |
| [W5.1 · A verse from a note: the card](../design/exports/workspace/w5-1-a-verse-from-a-note-the-card.png) | The chosen way (W5c): the verse at its link, Interlinear, Strong's, Definitions, Open the chapter ▾ | — |
| [W5.2 · The card's interlinear: words put away, and brought back](../design/exports/workspace/w5-2-the-card-s-interlinear-words-put-away-and-brought-back.png) | − on each word; the put-away row; Show all, Put all away | Whether put-away words are kept per verse (drawn) or for that Strong's number everywhere |
| [W6.1 · A new page from a template](../design/exports/workspace/w6-1-a-new-page-from-a-template.png) | From a template: the place, the new page's name, where it goes; Edit your templates | Whether to start with no templates at all (proposed), or with empty ones named Chapter study, Word study, Lesson outline |
| [W6.2 · Editing a template](../design/exports/workspace/w6-2-editing-a-template.png) | Templates as a sidebar section; a template edited block by block; `{` offers the blanks; the template's settings | Which blanks (drawn: `{place}`, `{date}`, `{title}`, `{reader}`) |
| [W6.3 · Templates in Help](../design/exports/workspace/w6-3-templates-in-help.png) | Help's entry (its text in wb-core, `wb guide templates`); the Templates page; `wb template list`, `wb page new --template` | — |
| [W7.1 · What to make](../design/exports/workspace/w7-1-a-page-made-into-a-document-what-to-make.png) | A page as a document's source, as a thread is; the structures; the theme | — (tier 4's scope is the Speaker Script and the verse deck) |
| [W7.2 · What goes in](../design/exports/workspace/w7-2-what-goes-in-and-what-each-block-becomes.png) | Each block and what it becomes; to-dos left out unless switched on; the pages inside, in order | What a to-do, a list and a view become (drawn: left out; your words; the view's list as made) |
| [W7.3 · Made, and every verse checked](../design/exports/workspace/w7-3-made-and-every-verse-checked.png) | The files, and each verse checked against the Bible | — |
| [W7.4 · The page keeps its documents](../design/exports/workspace/w7-4-the-page-keeps-its-documents.png) | Documents at the page's foot; Make again when the page changed since; a preview | — |

Definitions (W5) stay blank until tier 7's dictionary is chosen.

## What it would change in the study folder

All of it in files the Python app reads or passes over, as the rules require:

- **New front-matter fields** on notes: `parent` (the page it is inside), `order`, `pinned`, `template`. Notes stay where
  they are.
- **Two fenced blocks** in a note's body: ` ```scripture ` (a reference, and `lines` or `ylt` when chosen) and
  ` ```view ` (one command line). No scripture text is ever written into a file.
- **Templates** are ordinary notes with `template: true`, listed under Templates; their settings (the name new pages
  get, whether they ask for a place, where new pages go) are front-matter fields too.
- **Documents from a page** go to `documents/` in the Python app's format, as tier 4's from a thread, with a new
  source kind (`page`); whether the Python app lists those is checked when tier 4 is built.
- Which reader a plain click opens: `settings/notebook.json`, with the other Notebook settings. Which interlinear words
  are put away is not in the study folder at all (kept on this computer).

`scripts/backup-study.ps1` runs before the first of these reaches the real folder.
