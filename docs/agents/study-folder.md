# The study folder: what it holds and how it changes

Read this before changing anything that reads or writes the person's study files, documents, or the Bible database.
The rules themselves are in [AGENTS.md](../../AGENTS.md).

## Formats

The study folder's formats are this app's to shape (the person, 2026-11-12). They need not stay readable by the Python
app. What the person already wrote must never be lost: a change of format reads the old form, and moving the person's
files to a new form happens once, designed first, tried on a scratch copy, after a hashed backup
(`scripts/backup-study.ps1`), and only with the person's go-ahead.

Today the folder holds Markdown with front matter (pages, threads) and JSON (highlights).

- **Trash.** `.trash/` holds deleted notes and questions. One is erased after 7 days unless put back (the person,
  2026-11-03; the window does it when it opens, `wb trash empty` from a terminal), or at once with Erase now in the
  Trash, asked to confirm (2026-11-04; `wb trash erase <name>`). Nothing else is erased.
- **Findings.** `findings/` holds the person's findings about the app, beside `notes/` so the Notebook never lists them;
  `findings/<id>/` holds the files attached to a finding, copied in, 10 MB each at most.
- **Pages** (the person, 2026-11-09, [R1 decision record](../archive/2026-11-10/docs/redesign-R1.md)). A note, a
  question and a day are shown as pages; "note" is the old word, and `wb page …` is `wb note …` under the new name. How
  a page is kept on disk follows the design folders (pages lose their single place for references in their text:
  [marks](../../design/features/marks/README.md), 2026-11-12). Pinned is in `settings/pages.json`. A question written in
  a page is a callout line (`> [!question]`, `> [!done]`); a word put in a page is a ```` ```word ```` fence, and a
  ```` ```thread ```` fence shows the folder's saves; each holds only an id or a number, never the text.
- **Threads are folders with a color** (the person, 2026-11-17, [threads](../../design/features/threads/README.md)
  TH-1, TH-11): its places are the saves in the folder, in the folder's own order; its note is a page in the folder;
  pages written on it are pages in the folder. The window's word is "folder"; `wb thread …` keeps its contracts and
  works on folders with a color, and `thread:<slug>` still opens one (TH-3). Today's `threads/<slug>.md` files stay
  where they are and stay readable as folders with a color (until that is built, the app shows one as a page); moving
  them into the folders' own form happens only as a designed, backed-up move with the person's go-ahead (TH-2, TH-12).
- `wb study check` is the read-only check of what the folder holds.

## Documents

Documents (Word files, PDF slides) go to `WB_DOCS_DIR`; with the person's real study folder, to
Documents\Bible Workbench, where the person's documents already are; with any other study folder, to a folder beside it
(`<study>-documents`), so tests and scratch copies never write the person's documents. After a document is made, every
verse the source holds is checked in the finished file; one that fails is not kept.

## The Bible database

Follow [local provisioning](../../data/README.md) and select it with `WB_BIBLE_DB`, the setup screen or
`wb setup database` (otherwise `datasets/workbench.db` beside the program, or in the sibling `bible-workbench`
checkout). It is opened with SQLite's read-only flag.
