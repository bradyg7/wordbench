# R1, Everything is a page: the design round, for review

2026-11-09. The design round for R1 of [debug-spec.md](debug-spec.md) (findings `38c2`, `7d00`, `d84d`).

**Accepted and built, 2026-11-09:** the person's answer to the questions at the end was "run your recommendations, and
implement these designs", so every decision below is the recommended one (decision 9, the order, is moved: R1 was built
now). What was built, and how it was checked, is [phase2-results.md](phase2-results.md) section 28. The text below is the
design as it was written for review. Read from the real study folder, read only: the three findings, the notes they cite (`05f3`, `f4ac`, `6572`,
`4ad9`, `c39a`), the files' shapes and counts. The Python app's `Study` was run over a scratch copy only.

**The sheets:** `python design/r1.py` → `design/r1.figcraft` and `design/exports/r1/` (about 5 seconds; it reuses the
workspace and filter rounds' helpers). Every window on one board: [all.png](../design/exports/r1/all.png). Scripture on
them is from `design/content.json` (fetched from the database); the rest is demo writing about the Phinehas demo.

## The short answer

**The window says "page" for everything; no file in the study folder moves.** What the person asked for is a change in
what they see and write, and almost all of it can be had by reading the same files differently:

- A **note** is already a Markdown file with a first-line title; W1 and W3 already made those with no place pages, and
  let a page hold pages. What is left is to stop showing "notes" and "kinds" and to show a *page with a place*, *a page
  on a thread*, *a page that is a question*.
- A **thread** is its thread file **read as a page**: its note is the page's text (written in blocks), its places are
  scripture and word blocks in the thread's own order, the notes written on it are the pages under it. The thread file
  stays the file of record, so the Python app, the reader's colored underline, `wb thread`, sets, and the documents made
  from a thread all keep working untouched. **The Threads button and pane go.**
- **`/?`, `/~` and `/word`** are three more blocks in the `/` menu: a question, a thread's places kept up to date, and a
  Strong's entry. All three are text in a page; none needs a new kind of file.
- **Migration is none.** There is nothing to convert. What the build adds is a read-only check of the folder and a test
  that the Python app still opens the result.

The rest of this document says why each answer, and what the other ways cost.

## What is there today (so the answers rest on facts)

| Thing | File | Python app | In the real folder (9 Nov) |
|---|---|---|---|
| A note at a place | `notes/<BOOK>/n_….md`, `anchor` | reads it, shows it at its place | 40, and 1 on a word (`notes/_words/`) |
| A note with no place | `notes/_inbox/n_….md` | skips it (no anchor) | 52 (51 `jot`, 1 `question`) |
| A note on a thread | `notes/_threads/n_….md`, `threads: [id]` | skips it | 3 |
| A question at a place | `trails/q_….md`, `status` open or done | reads it (its Trails) | 8, all open |
| A thread | `threads/<slug>.md`: name, color, note, `<!-- anchors -->` list | reads **and rewrites** it from its own model | 7, with 146 places (verses, runs, words in a verse, Strong's numbers) |
| A set | `sets/<slug>.md`, items may be `{"kind": "thread", "ref": "<slug>"}` | reads it | 4, one holds two threads |
| A document | `documents/<id>.json`, `source` thread, page, passage or lesson | lists thread, passage and lesson ones | 3 records: one from a thread, one page's script and deck |

Two things in that table decide a lot:

1. **Both apps rewrite a thread file from a fixed model** (`name`, `created`, `updated`, `color`, the note, the anchors).
   Python does it in `study.py`, and so does this app's `write_thread`. Any extra front matter put on a thread file is
   dropped by the next write, from either app. So a thread's page fields (where it sits in the tree, pinned) cannot live
   in the thread file; they need a place of their own (question 2).
2. **The Python app reads a note only if it has an anchor.** Pages with no place, and anything new in them, are invisible
   to it and so cannot be damaged by it; a placed page's new blocks show to it as plain text in the note.

What a thread is *for* (so a page that replaces it must keep it): a name and an ordered list of places (verse, run,
**word in a verse** with its position, **Strong's number**); a color, which is the underline in the reader (`marks.rs`,
for every chapter drawn); a note; notes written on it; sort and filter (T1); `+name` in the command field and the *Add to
a thread* chooser from search, uses and the card; `marked in <thread>`, `hl list --thread`, `notebook thread <name>` views;
items in sets; documents (Speaker Script, Verse by Verse, and the Python app's Thread Dossier and Thread Map).

## 1. Is the file a page for everything, or only the window?

**Recommendation: only the window.** Keep every file where it is and in its format. A "page" is what the window calls any
of them. The window drops the kinds (`verse`, `word`, `phrase`, `jot`, `thread`, question, day) as things a person has to
tell apart; what a page *has* shows as chips: a place, a thread, a question.

This is nearly true already. A note is a Markdown file; W1 made a note with no place a page; W3 let a page be inside
another (`parent`, `order`, `pinned`). What is not yet a page in the window is a placed note, a question, a thread note,
and a thread.

| | What it is | Cost |
|---|---|---|
| **A. Window only** (recommended) | The folder as it is. The Notebook reads notes, questions and threads and presents them as pages. | The smallest: UI, and a few read functions in wb-core. Nothing to migrate, nothing the Python app can lose. The cost is only that three stores stay separate underneath (`notes/`, `trails/`, `threads/`), which the person never has to see. |
| **B. A new `pages/` folder** the app writes, with the old folders read for the rest of the time | One model on disk; places as front matter. | A second source of truth beside the Python app's. Every page the app writes there is invisible to the Python app's margins, threads, trails and documents. The person's study would be split between two layouts for as long as both apps are used. |
| **C. Convert every file** (a verse note becomes a page with `places:`; a thread becomes a page; trails become pages) | One model, everywhere. | About 110 files rewritten (96 notes, 8 trails, 7 threads), against a folder that is the person's real work. The Python app stops reading its own notes (it needs `anchor` and `notes/<BOOK>/`), its trails and its threads. `scripts/doc-plans.py` can no longer ask the Python app for a thread's plan, so the fingerprints agree only by assertion. A one-way door while the person is told both apps open the folder. |

**Words that change** (the window, `wb`, Help; not the folders): "Notes" → "Pages" (the Notebook's sections, the pen, `Notes &
lookup` → "Pages & lookup", the verse card's row). `wb note …` stays and `wb page …` is the same command under the new
name, since the Python `wb` has `wb note` and its golden cases use it. CLAUDE.md's rules say "notes" in several places; editing them is
the person's to approve, so it comes with the build as a diff, not quietly.

**The Kind chip of S8** (held until this is decided): there is no kind. The filter row's chips become properties: *Place*,
*Thread*, *Questions* (open, answered), *When*. A page that has none of them is just a page. The S8 sheet's Kind chip is
dropped; the rest stands.

## 2. A thread as a page

**Recommendation: the thread file, read as a page, with a `thread` block for putting a thread inside any other page.**
Drawn in R1.2 and R1.3.

What the thread's page is, from the same file:

- **Its title** is the thread's name. **Its text** is the thread's note, written in blocks like any page (the note above
  `<!-- anchors -->` is plain text to the Python app, which keeps it as it is; headings and lists in it show to the Python
  app as Markdown marks). Saving it is `wb thread edit --note`, which exists.
- **Its places** are blocks in the thread's own order: a verse or run is a scripture block (text from the database, with the
  person's marks, as W4's verse card draws it); a Strong's number is a word block; a word in a verse is its verse with the
  word picked out, as the document plan already does. Drag by the grip reorders (`wb thread order`), × takes one out
  (`wb thread rm`), `+ Place` adds one, Open asks reader or new reader. S5's read-only list of places is the first draft of
  this and is replaced by it.
- **The pages on it** are the notes with `threads: [id]`, listed under the places and in the sidebar tree under the
  thread. A page can be on several threads and shows under each (so it is a tag, not a parent, which also answers
  `d84d`'s "referenceable and taggable"). "Write on this thread" starts one (`wb thread write`).
- **The head** has what the Threads window had: the color (still the reader's underline), Sort (Bible order or the
  person's), Filter, Make a document. Documents are at its foot.
- **In the tree:** a thread sits in Pages with its color's dot, and can be pinned. That position is the one new thing a
  thread page needs stored, and it cannot go in the thread file (see above), so it goes in **`settings/pages.json`**, a
  new file the Python app passes over (as it passes over `settings/notebook.json` now). A thread is not nested inside other
  pages in the first build; the file can hold it later without a change.
- **`[[Phinehas]]`** in any page links to the thread's page, as it links to a page by title; when a page and a thread have
  the same title the link asks which.

**The `thread` block (`/~`).** A page that holds a ` ```thread ` fence (its body is the thread's id) shows that thread's
places, kept up to date, the way a view block shows a list. It is how a lesson page holds a thread without copying it, and
why the Threads tab is not needed to *use* a thread, only to *browse* them (the sidebar's Pages tree and a view).

**What goes away:** the toolbar's Threads button and the Threads pane (`openThreads`, `openThread`), the sidebar's separate
Threads section, and on the phone sheets the Threads tab (Read, Notebook, Study, More remain). `+name`, *Add to a thread…*,
the thread chips and the capture box's thread commands stay: they are actions, not a tab, and they now end at the thread's
page. A set's `thread` item opens the thread's page (its `ref` is the slug, which is stable and unchanged).

| | What it is | Cost |
|---|---|---|
| **A. The thread file read as a page** (recommended) | As above. | Edits to the note and the places go through the thread functions that exist. One file per thread, as now. Free-form prose *between* places is not possible, since the places are one list at the end of the file; the pages written on the thread and the `thread` block in another page cover most of that wish. |
| **B. A thread becomes a page file** whose body holds scripture blocks, with `threads/<slug>.md` kept as a mirror the app regenerates on every save | Prose and verses interleave freely. | Two writers to one truth: a verse added in the Python app is lost on the next mirror, and order and word anchors (the `GEN.26:14.18` kind) have no scripture-block form and need a new fence. The reader's underline, documents and sets read the mirror, so it must never be stale. The most work, and the Python app sees only the mirror. |
| **C. Dissolve threads** (a page of scripture blocks with a color) | One concept. | The reader's underline and `marked in <thread>` would read pages, not threads; the Python app loses its threads altogether; the thread-sourced documents lose their source (question 3). It removes a feature the person uses (the Phinehas threads are 56 and 19 places). |

## 3. A document made from a thread

**Recommendation: the source stays the thread. Nothing about thread documents changes.** Drawn in R1.6 and R1.7.

- A thread page's *Make a document* and its Documents foot use the same records as today, `documents/thread-<slug>-….json`
  with `source: {"kind": "thread", …}`. Both apps list them, and a Word file or deck the Python app made on 3 November is
  still "this thread's".
- **The fingerprints stay shared.** A document's `plan` fingerprint hashes the *plan* (what goes where), not the source, and
  `thread_source`/`thread_blocks` are not touched, so `scripts/doc-plans.py` still compares the Python and Rust plans
  thread by thread (14 cases today: 7 threads × Speaker Script and Verse by Verse). That cross-check is the only
  independent proof that the Rust plan is right; options B and C of question 2 would end it.
- **One boundary.** `thread_blocks` reads the thread's note as one line of speech. If the person writes headings or lists in
  a thread's note (which the page allows), the Rust plan could read them as sections as pages do, and then it would differ from
  the Python plan on purpose. The recommendation: a thread whose note is plain text is unchanged (all seven today: four
  have no note, three are one plain line); a thread whose note has Markdown structure is made by the page rules, and
  `doc-plans.py` lists such a thread as "different by design" instead of failing. The person can say instead that a thread
  note is always one line of speech for documents, which is simpler and loses the use of headings there.
- **A page with a `thread` block** makes a `page-…` document (W6's records, which only this app lists). The block's places
  go in exactly as the thread's do, through the same function; its row in *What goes in* has a switch like any block's. The
  build adds a test: a page that holds only a thread block plans the same verses, in the same order, as the thread.
- A question in a page is a row (your words, as lines; answered ones included, to-dos left out as now); a word block is left
  out unless switched on.

| | Cost |
|---|---|
| **A. The source stays the thread** (recommended) | None to the records. The page-with-a-block row is new, and small. |
| **B. A thread document's source becomes a page** (`page-<slug>-…`, the thread read through the page converter) | The person's existing thread records say `thread` and would be "gone" or rebuilt under new names; the Python app stops listing them; the Python half of `doc-plans.py` has nothing to compare; the Thread Dossier and Thread Map (Python's, phase 5) have no source. |

R3 (documents' designs) may change plans on purpose and break the agreement with the Python app; that is R3's decision and
does not depend on this one, since R1 leaves the plan code alone.

## 4. Questions as `/?` blocks

**Recommendation: a question is a block you can write in any page; the pen's `?` stays for asking at a verse; both are one
list.** Drawn in R1.3 and R1.4.

- **`/?` writes a callout line** in the page's Markdown: `> [!question] How do the two numbers relate?`; answered, `> [!done]
  …` (Obsidian draws both natively as callouts; the Python app shows a quote). It is an ordinary quote block with a marker,
  so the block splitter needs only to recognize the marker, and the block draws with a *Mark answered* control, as a to-do
  has its tick. A quote that starts any other way is unchanged.
- **Where it lists.** Questions (the section) becomes a view over every question: the blocks in all pages, plus the existing
  question files. `notebook questions open|done` already says it; `wb questions` is extended to include blocks. The count in
  the sidebar and the Answered state are one thing in both forms.
- **At a verse.** A question block takes its page's places (`anchor` and `also`). The reader's `?` on a verse number and the
  verse card's *Questions* group read the same index, and match by **overlap**, so a question asked of part of a verse
  appears in the verse's card. That is `c39a` ("questions aren't always apparent … especially if they wrote a question on
  part of the verse"); the build checks the cause first (a list that matches only the whole verse is the likely one) and
  fixes it whichever way this question is answered. A question in a page with no place has no verse, as an Inbox question has
  none now.
- **The two ways stay.** Ctrl+J and the pen's `?` at a verse still write a trail (`trails/q_….md`), so the Python app's
  Trails keeps seeing them, and the eight existing trails and the Inbox question are untouched. In the window all of them
  are "a question". Two small actions, each with an Undo and neither automatic: *Fold into this page* (a trail becomes a
  block) and *Give it its own page* (a block becomes a trail, if it has a place).

| | What it is | Cost |
|---|---|---|
| **A. Both kept, one list** (recommended) | As above. | A new question written as a block is not seen by the Python app's Trails. That is the cost of doing what `7d00` asks while the Python app is still around; a block is a line in the page it was written in, so nothing is lost. |
| **B. Blocks only**, trails folded into pages by a migration | One storage. | The Python app loses its Trails entirely, and eight files are rewritten (with a backup and a dry run, per question 6). A fair end state once the Python app is retired, not before. |
| **C. Trails only**; `/?` writes a trail and draws it inline | The Python app keeps seeing every question. | An inline question that is really another file: it has to be kept in step with the page it appears in, and a page with no place cannot have one. It is the reading of `7d00` that is least like what it says. |

The callout syntax is a choice too: the alternatives are a leading `? ` line (shorter, and Obsidian shows it as plain text)
or a ` ```question ` fence (no Obsidian rendering). The callout is recommended because the person opens the folder in
Obsidian; the choice is cheap to change before anything is written.

## 5. Word studies

**Recommendation: a word study is a page placed at a Strong's number; a `word` block draws the lexicon's entry at its top.**
Drawn in R1.5.

- The existing `notes/_words/` note (anchor `H7065`, kind `lemma`) **is** that page; nothing converts. A placed page's chip
  reads `H7065`, and the Notebook's Places already groups it.
- **`/word`** inserts ` ```word ` with the number and nothing else. The block draws the entry from the database as the card's
  Strong's step does (the word, its sound, Strong's own words, the KJV's renderings and how often, the count); **the entry
  is never copied into the file**, as scripture is not.
- **A thread's Strong's-number members** appear on its page as word blocks (as R1.2), and in a document as the plan already
  makes them (the original words after the places).
- **The English definition** (R5) is the one thing missing, and the block reserves a slot, drawn dashed and empty:
  *waits for the source you choose*. The rule "no commentary, no doctrine" is why it waits for the person.
- **Words in a verse** (`GEN.26:14.18`, the marked word with its position) stay a scripture block with the word picked
  out, since a word is a part of a place, not a place of its own.

| | Cost |
|---|---|
| **A. A word block plus a page at the number** (recommended) | One fence kind; no new file; the existing note is the page. |
| **B. A word study as its own page kind** with fields (lemma, renderings, uses) | It would store what the lexicon holds, and drift from it; a second copy of data the database already has. |
| **C. Only the card** (as now) | A word study page cannot show the entry beside the person's words; they flip between the card and the page. |

## 6. Migration

**Recommendation: none is needed, so the process is a check, not a conversion.** Drawn in R1.8.

With A throughout, R1 writes only what the person writes: thread note and place edits go to the thread file as they do now;
a question or a thread or word block is a line in a page when the person adds one; `settings/pages.json` appears the first
time a thread is pinned or placed in the tree. No existing file is rewritten by installing it.

The protocol still stands for anything that *would* rewrite (the two optional question actions above, a later fold of trails,
the 4 `_threads` notes if the person ever wants them elsewhere), and for the first time the new build meets the real folder:

1. **Back up first**: `scripts\backup-study.ps1` (hashed, reads only), as before any build that writes to the real folder.
2. **Check, read only**: `wb study check` (new; the window's *Check the study folder*), which opens the folder, counts
   what it holds, lists every file the next change would write (here: none, or the one new settings file), and says so.
   Nothing is written.
3. **Apply per item, each with an Undo** (the `.trash/` behaviour D1 already designs), never in bulk.
4. **The Python app still opens it**, as a test, not a promise: `scripts/py-opens.py` (new) opens a scratch copy with the
   Python app's own `Study`, before and after, and compares what it reads. Today it reads **41 notes** (those with a place),
   **7 threads**, **8 trails**, **4 sets** and **146 thread places**; after the change it must read the same. With
   `scripts/doc-plans.py` for the fingerprints (14 of 14), it is the check that "same files, same formats" is true.
5. **The real folder** only on the person's go-ahead, as with every earlier phase.

What the Python app does with what is new: it ignores `settings/pages.json`; it shows a `thread` or `word` fence as code
and a question callout as a quote; it does not see a question block as a trail. Nothing it reads is altered.

## Where R1 meets the other redesigns

- **R2, the Shelf.** A set's `thread` item opens the thread's page; its `ref` is the slug, unchanged. R2's "files as an
  Obsidian tree" idea and R1's tree of pages are two views of one list; whichever is accepted first should say so, and the
  Shelf's item kinds lose "thread" as separate from "page" only in the words.
- **R3, documents.** R1 leaves the plan code and the records alone. R3's new designs apply to a thread's page and to a page
  with a thread block alike.
- **R4, the toolbar and Settings.** The toolbar's Threads button is not offered in *Customize*; R4's "More ⋯" is the app's, unchanged by this.
- **R5, the dictionary.** The word block's empty definition slot is where R5's source goes.
- **S5 and S8.** S5's read-only list is replaced by the thread page; S8's filter keeps all its chips but Kind (question 1).

## What the build would be, if accepted

Sizes as in the spec; each step ends with its desk check, `npm run test:webkit` where it is layout, `cargo test` where it is
core, golden cases where the Python `wb` has the command, a screenshot in `docs/phase2/`, and a line in
`docs/phase2-results.md`. Real input is needed for the drag (M1's lesson).

| Step | What | New in wb-core and `wb` | Size |
|---|---|---|---|
| R1a | The thread page: note as blocks, places as blocks, pages on it, color, sort, filter, Documents foot; the Threads button, pane and sidebar section go; `[[thread]]` links | `wb thread page <name>` (the page as JSON); `settings/pages.json` and `wb thread pin|unpin`; links resolve thread names | L |
| R1b | `/~` and `/word`: the two fences, drawn live; documents' rows for them | `wb word show` (the block's content); the rows in `craft parts` | M |
| R1c | `/?`: the callout block, the index over blocks and files, the reader's `?`, the card's group, `c39a` | `wb questions` includes blocks; `wb question answer`; *fold* and *give its own page* as `wb question fold|unfold` | M–L |
| R1d | The words: Notes → Pages in the window, Help and the capture box; `wb page` beside `wb note`; the `wb study check` and `py-opens.py` checks; CLAUDE.md edit (shown as a diff) | `wb study check` | S–M |

R1d's check and `py-opens.py` should be built **first**, since they are what makes the others safe. Every new command gets
a case in `every_action.rs`, and a golden case where the Python `wb` has the command. No scripture is typed anywhere: the
blocks hold references and numbers, and the tests' verses come from the database.

## The sheets

| Window | What it answers |
|---|---|
| [R1.1 · One list](../design/exports/r1/r1-1-one-list-the-notebook-after-r1.png) | The Notebook after R1: no Threads button or section; threads and questions are pages in one tree |
| [R1.2 · A thread as a page](../design/exports/r1/r1-2-a-thread-as-a-page.png) | The thread file read as a page: note, places as blocks, pages on it, color, sort, filter |
| [R1.3 · Writing: three new blocks](../design/exports/r1/r1-3-writing-three-new-blocks.png) | `/?`, `/~`, `/word` in the `/` menu; a question open and answered; a thread block |
| [R1.4 · Questions](../design/exports/r1/r1-4-questions-written-anywhere-found-at-the-verse.png) | One list for both forms; the reader's `?`; the verse card lists a question on part of a verse |
| [R1.5 · A word study](../design/exports/r1/r1-5-a-word-study.png) | A page at H7065 with a word block; the definition slot held for R5 |
| [R1.6 · Documents from a thread page](../design/exports/r1/r1-6-documents-from-a-thread-page.png) | The thread's own records, unchanged, at the page's foot |
| [R1.7 · A page that holds a thread block](../design/exports/r1/r1-7-a-page-that-holds-a-thread-block-made-into-a-document.png) | What goes in, with a question row and a thread row |
| [R1.8 · The check](../design/exports/r1/r1-8-the-check-nothing-is-rewritten.png) | The read-only check, with the real folder's counts |

The first sheet carries a table of every thing in the folder, its file, what the window calls it after R1, and what is new
in a file.

---

## The decisions waiting on the person

Each has a recommendation; "yes to all" is a fine answer. Nothing is built until these are answered.

1. **Window or file.** The window says "page" for everything and no file moves (A, recommended); or a new `pages/` folder
   (B); or every file converted (C).
2. **A thread as a page.** The thread file read as a page, plus a `thread` block (A, recommended); or a page file with the
   thread file as a mirror (B); or threads dissolved (C). *And* whether the Threads button and pane go (recommended: yes,
   with the phone's Threads tab).
3. **Where a thread sits in the tree.** `settings/pages.json`, not in the thread file (recommended, since both apps rewrite
   that file and would drop it); and threads are not nested inside other pages at first.
4. **Documents from a thread.** The source stays the thread, fingerprints stay shared (A, recommended). *And* what a
   thread's note becomes in a document once it has headings or lists: read by page rules, with `doc-plans.py` marking it
   "different by design" (recommended), or always one line of speech.
5. **Questions.** Both ways kept, one list (A, recommended; the cost is that a new question block is not in the Python
   app's Trails); or blocks only with the trails folded in (B); or trails only (C). *And* the syntax: the callout
   `> [!question]` / `> [!done]` (recommended), a leading `?`, or a fence.
6. **Word studies.** A page at the number plus a `word` block, the English definition held for R5 (recommended).
7. **Migration.** None to run; the build begins with the read-only check and the Python-opens test, and a backup before the
   real folder is touched (recommended). *And* confirm that, until the Python app is retired, it will not see question
   blocks as trails, and will show the new fences as text.
8. **The words.** "Notes" becomes "Pages" in the window and Help, `wb note` stays beside `wb page`, `/note` in `7d00` is the
   existing *Page inside this one*, and CLAUDE.md is edited to match (you approve the diff).
9. **The order.** R1 after R2 (as the spec says), R1d's checks first within it; or R1 first, since it is the one the
   Threads tab's removal waits on.
