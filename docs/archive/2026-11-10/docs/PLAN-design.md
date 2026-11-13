# Plan: design layouts for phone, desktop and a distraction-free reading device

Status: design round 1 done for review, 2026-11-02 (inventory, design system, phone and desktop/laptop layouts, e-reader
recommendation, all in [design/](../design/README.md); answers in section 5). Nothing in this plan is built in the app.
Since then (2026-11-02, the person): the e-reader is **parked**; the phone is an iPhone, but the app must serve iPhone, iPad,
Android and desktop alike; and the app will be **rebuilt in Rust in a new repository**, leaving the Python/Windows build
behind (this repository stays). The implementation plan for that is [PLAN-mobile.md](PLAN.md).
Originally a handoff. It gathers where the app stands, the ideas raised while building the
Phinehas demo, and the Notebook proposal, so design work can start from one place. The first deliverable is design sheets, made
with FigCraft; code follows only once a layout is agreed.

Note the scope change: [SPEC.md](../../../SPEC.md) section 2 lists "phone app and sync" as a non-goal for v1. This plan is the start of
lifting that, so whatever is decided here should end up as a SPEC revision, as the person accepts it.

## 1. What to design

1. **Mobile** (phone, portrait first, landscape second).
2. **Desktop and laptop**: the current window, redesigned where it needs it, and checked at laptop widths (1280 to 1440 px) as
   well as a large monitor.
3. **A dedicated reading device** (*parked 2026-11-02: not the first priority*): a Kindle, Kobo, Boox or similar e-reader that runs only this app. No notifications, no other
   apps, no distractions: the Bible, study and nothing else. Section 6 has what is known so far.

For each: full design sheets (every screen and state, the components, type scale, colors in light, dark and e-ink) as well as
the layouts themselves.

**Tool:** FigCraft, one of the ArtCraft apps (Start menu shortcut:
`C:\Users\brady\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\FigCraft.lnk`; the launcher there installs and updates the
ArtCraft apps). The workbench already drives WordCraft, DeckCraft and PdfCraft through their command lines
(`workbench/craft_export.py` finds them; `wb craft raw <app> ...` reaches their full CLIs), so look first for a FigCraft CLI or
automation interface the same way. If it has one, design files can be produced and changed reproducibly from scripts.
Keep the design source files in the repo under `design/` (beside `design-samples/`, which holds the export theme samples).

## 2. The app as it stands (branch `export-redesign`, commit 768f298)

**How it runs.** A Python server (`workbench/server.py`, port 8765) serves the web app in `web/` and the study data. The window
is a browser app window opened by `launch.pyw` / `wb app`. Everything is local: the KJV/YLT and lexicon database
(`datasets/`, SQLite) and the person's study files (`../bible-study-data`, plain Markdown and JSON, also opened in Obsidian). There
is a `manifest.webmanifest` and a viewport meta tag, and `web/style.css` already has narrow breakpoints at 720 px and 520 px, but
nothing was designed for a phone.

**What the person uses** (each is worth a screen or a state in the sheets):

- **Reader**: book and chapter pickers, previous and next, KJV with verse numbers, the person's highlights drawn in, hover cards on
  a verse reference or a word (the verse text, or the lexicon entry). Arrow keys scroll and turn chapters. Text size control.
- **Toolbar**: Search, Capture, Trails, Threads, Shelf, Documents, Highlights (with a layers menu: your own highlights, and each
  thread's), a tray of minimized panes, and a More menu (find in chapter, read aloud, hover cards on or off, save the chapter as
  a PDF, the PDF viewer, Documents, text size, hide the toolbar).
- **Panes** (dockview: docked beside the reader or floating, minimizable, at most 16): a second passage, the interlinear (Hebrew
  and Greek word by word), a lexicon entry, BDB, define, search, uses (every occurrence of a word), count, near, forms, lexiconc,
  My notes for a place, Threads home, a thread, Trails, today's log, Help, Shortcuts, Documents, a lesson, the PDF viewer and the
  Shelf (sets).
- **The capture box** (backtick): a command language for everything (`open`, `note`, `?question`, `+thread`, `hl yellow`, `uses`,
  `doc`, `deck`, `lesson build`, `set ...`, `layers ...`). The grammar is `web/commands.js`, the manual `web/help-docs.js`. This is
  keyboard-first and needs a different answer on touch.
- **Selection**: select words or verses in the reader, then highlight, note, add to a thread, copy, or look up.
- **Study data**: notes on a word, phrase, verse or Strong's number; highlights in five colors plus custom ones; threads (named,
  ordered sets of places with a note); trails (questions queued under a place); sets (named groups of panes, threads, places,
  notes, lessons and PDFs); lessons (`lessons/<name>.md`).
- **Listening**: read aloud in the browser's voice, and recorded-voice playback of the person's own recordings (phase 1 of
  [PLAN-recording.md](../../../../../bible-workbench/PLAN-recording.md)).
- **Documents**: slide decks and Word files built with DeckCraft and WordCraft from a passage, a thread or a lesson. Purpose
  presets (Teach it, Hand it out, Study it, Send it, Thread overview) with the structure and theme pickers under Customize; six
  themes (vellum, vigil, olivet, veil, daylight, and print, which is black on white with no fills). Each document is one file
  kept up to date from its source. This is desktop-only by nature (the Craft apps), but a phone should at least list documents,
  open their PDFs, and ask the desktop to build one.

**Rules every design must keep** (SPEC section 1, CLAUDE.md):

- Scripture is shown verbatim with its reference. The app adds no interpretation, commentary or doctrine.
- The person's study files are the source of truth and stay plain files they can read by hand.
- Never make the person lose their place; capturing a thought must not leave the verse.

## 3. The Notebook (proposed, not built)

Today every note must be attached to a place, and notes can only be seen one place at a time (My notes) or found with `find`.
The person wants a journal they can open to reach their notes easily, and a catch-all for thoughts that can be given a verse
later. Four angles were weighed: a free daily page (fast to write, but a reference in prose is not anchored, and splitting a page
later is fragile); an inbox to triage (right for catching, but an inbox alone goes stale and is no way back into all notes); one
note model with an optional place (no copying, placed notes reach documents, but every reader of notes would have to skip unplaced
ones); and views over the notes (the access problem, without changing storage).

**Proposal: one Notebook pane, three views, one kind of note.**

- **Journal tab**: every note, grouped by the day it was written, newest day first, with a writing box at the bottom of today
  (Enter adds an entry, Shift+Enter a new line). A note given a place later still shows on its day, with its place beside it.
- **Inbox tab**: only the notes with no place yet, each with **Place it...**. If the text names a reference, that place is offered
  first; otherwise type one, or use what is selected in the reader. A placed note is an ordinary note: in the reader's margin, in
  My notes, and in Study Sheets, the Study Table and Pulpit speaker notes.
- **All notes tab**: placed notes in Bible order, with a filter and a jump to each place.
- Selecting a phrase in the reader and writing a note works as it does now.

**Storage (the decision that keeps it safe):** a note with no place is its own Markdown file in `notes/_inbox/`, same format as
other notes, and is kept out of `Study.notes()` behind a list of its own. So the reader margins, threads, sets, `find` and the
document plans see only placed notes and do not change. Placing moves the file to `notes/<BOOK>/` with its anchor set, keeping
its id and the day it was written. Still one plain `.md` per note, readable in Obsidian.

**Commands:** capture box `jot <text>`, `place <part of it> @Num 25:11`, `journal`, `inbox`; `wb note jot "text"`,
`wb note place <id> "Num 25:11"`, `wb journal [day]`, `wb inbox` (each route needs a `wb` command, each capture command a help
entry; see CLAUDE.md).

**Phases:** (1) the pane, unplaced notes, Place it, the commands and tests; (2) place on the reader's selection, drag from the
Inbox onto a verse, one note on several places; (3) a decision for the person: fold Trails into the Notebook as questions (a
journal entry marked "?"), so Trails becomes a filter instead of a separate feature.

**For the design work:** the Notebook is the natural home screen on a phone and on an e-reader (write a thought, read, place it
later), so design it into all three layouts from the start, not as an afterthought.

## 4. Other ideas and findings from this round

- **Trails felt useless in the Phinehas demo.** Questions were queued but nothing brought them back into the work. Folding them
  into the Notebook (above) is one answer; the design should show where an open question surfaces again (at its verse, in the
  Notebook, in a lesson).
- **Document customizer.** Done in part: purpose presets with Customize underneath, and your own saved presets. Still open: a
  real preview of what a preset makes before building it, and the person's own visual design (fonts, colors, layouts) as a theme
  of their own. FigCraft may be the place to design that theme.
- **Hover cards do not exist on touch or e-ink.** Every hover card needs a tap equivalent (a bottom sheet on a phone, a popover
  or side panel on an e-reader).
- **The capture box is keyboard-first.** On a phone it needs a touch form: a command palette, a floating action button for
  jot, note, question and highlight, or both. The language itself should stay, for a keyboard case or the desktop.
- **Panes.** Docked and floating panes do not fit a phone. Likely a single stack with the reader as the base, and panes as full
  screens or bottom sheets with a way back to the place.
- **Long decks.** The Phinehas Pulpit deck came to 117 slides; a thread or lesson with many places may want a "compact" choice.
- **The Phinehas demo** (`demo/phinehas-command-log.md`, `demo/phinehas-lesson.md`) is a full worked example of the study
  workflow, useful as real content for the design sheets instead of placeholder text.

## 5. Questions for the design work to answer

1. **How does a phone reach the study data?** The app is a local server today. Choices: the phone talks to the desktop's server
   on the home network; a sync of the study folder (it is a git repo and an Obsidian vault already) with the app running on the
   phone as an installable web app over a local copy of the database; or a native shell. This decides what works offline.
2. **What is the phone for?** Reading and capture on the go, with heavy study and documents on the desktop, or everything?
   Default assumption: read, highlight, note, journal, threads and trails on the phone; documents listed and opened, built on
   the desktop.
3. **Which e-reader?** See section 6. Pick one target device before designing its layout in detail.
4. **One design system across all three**, with the e-ink version as a constrained variant (grayscale, no motion), or a separate
   e-ink design?

### Answers so far (design round 1, 2026-11-02)

The sheets are in [design/](../design/README.md). What they answer, and what is left for the person:

1. **How a phone reaches the study data: answered by the move to Rust.** The phone is an iPhone, and the app must also
   run on iPad and Android. An iPhone cannot run the Python server, and a phone that needs the desktop switched on is not
   the experience wanted, so every device runs the app on its own: the Bible database bundled, the study folder kept on
   the device in the same plain files, and the folders kept in step by git with a private remote. Nothing needs the
   desktop to be on. Details, and why git: [PLAN-mobile.md](PLAN.md), section 4. (The earlier two-stage answer,
   desktop server over Wi-Fi then Termux on Android, is dropped: it did not work for an iPhone.)
2. **What the phone is for: designed on the default.** Read, highlight, select, note, journal and place notes, questions,
   threads, search, every use, the interlinear, the lexicon, the book picker, documents listed and opened as PDFs. With the
   Rust rebuild, documents no longer need the Windows Craft apps, so a phone can make a PDF itself (PLAN-mobile.md,
   section 5); the Documents sheet's "Rebuild on the desktop" becomes "Make it here". Still not on a phone: more than one
   pane at a time, and long editing (lessons) is possible but designed for the iPad and desktop.
   Landscape gets the reader and one side panel.
3. **Which e-reader: parked (2026-11-02).** The research stays in [design/e-reader.md](../design/e-reader.md). Earlier answer, a recommendation, not a choice: An Android e-ink tablet with the Play Store (Boox Go 10.3 Gen II
   for desk and lap, a 7-inch model for a pocket), tried first in its browser against the desktop server, then locked
   with Android's lock task mode. Kobo and Kindle need much more work; reMarkable is a later, pen-first project. Details,
   steps and sources: [design/e-reader.md](../design/e-reader.md). **The person chooses the device; its layout comes after.**
4. **One design system: answered, one.** Every color is a FigCraft variable with Light, Dark and E-ink modes (E-ink starts
   from the Print theme: black text, black rules, grays for highlights, solid and dashed black underlines for threads,
   no dimming behind sheets). Type, spacing and components are shared; e-ink only raises sizes (scripture 21/38, tap
   targets 56). The "One system, three modes" panel of the design-system sheet shows the reader and a verse sheet in all
   three.

**Design decisions made on the sheets, for the person to accept or change** (review 2026-11-02: the merged command
field and Trails folded into the Notebook are accepted; the reading font is **Literata**, chosen from `design/fonts/compare.html`):

- *Phone:* five tabs (Read, Notebook, Threads, Study, More); the reader is the base; a pane becomes a full screen with a
  "Back to Numbers 25:11" pill, or a bottom sheet over the reader. Hover cards become **tap cards**: a verse number raises
  the verse sheet (text, color, notes, threads, actions), a word raises the word sheet (Strong's entry, count, every use,
  interlinear), a reference in a note raises the verse with Open and Place it here. A selection gets a floating bar
  (five colors, Note, Thread, Look up, Copy). The capture box becomes a **palette** anchored to the verse: quick actions
  (Jot, Question, Highlight, Thread, Open) and suggestions from the same command language. The pen button opens it.
- *Desktop:* the toolbar keeps one row; **search and the capture box merge into one command field** (backtick still
  opens it), with grouped suggestions; Shelf and Documents move into More below 1366 px. The **Notebook docks on the
  right** (420 px; 380 on a laptop) as the main side pane, with other panes as tabs beside it. Hover cards stay.
- *Notebook:* Journal / Inbox / All notes as proposed in section 3. **Trails are folded in** (phase 3 of the Notebook):
  a question is a note marked "?", shown as a ? on its verse number in the reader until answered, in the Journal, and
  in the Inbox while unplaced. This is how an open question comes back into the work (section 4, first finding).
- *Reader marks:* a note on a whole verse is a dot after the verse number; a note on words keeps the dotted underline.
- *Type (decided: Literata for scripture in the app):* the sheets use Merriweather for scripture because it is built into FigCraft and holds up on e-ink; the app uses
  Iowan Old Style / Palatino. **Which reading face the app should use is the person's choice** (Merriweather is OFL and
  could ship with the app, so phone and e-reader would match the desktop).

**The dock's base (decided 2026-11-04, phase 2b tier 1 step 1): our own dock, extended; not dockview-core.** A short
spike (`spikes/dock/dockview-spike.mjs`, run against the Python app's vendored dockview-core 8.6.0) put a reader panel
between two columns and two floats in WebKit. It drew them with no errors and kept the reader's scroll when a column
closed, but at phone width it only splits the screen (the reader was 195 px of 390), so the Compact form, one pane as a
full screen with "Back to …", would still be our own code beside it: two docks. dockview-core is 537 KB minified, against
121 KB for the whole of our UI's script, and the reader would have to become one of its panels, moving the reader's own
scrolling and the place-keeping that every size change relies on. What dockview would have given, drop zones and
separate floats (D1, V2), is built into `ui/src/dock.ts` as groups: a group is one tab strip and its panes, in a
column (split one above another), a band across the top or the bottom of the reader, or a floating window of its own.

Not designed yet: the iPad (portrait, landscape, split view and Stage Manager windows; see PLAN-mobile.md section 3), the
e-reader layout (parked), landscape beyond one screen, tablet sizes between phone and
laptop, the Help, Lesson, PDF viewer and Shelf panes in their new form, and the document maker's preview.

## 6. The distraction-free reading device (parked 2026-11-02)

Goal: a device that boots into the workbench and nothing else. Constraints any e-ink layout must meet: grayscale only (the
**print** export theme is the right starting palette), slow and visible screen refresh (no animation, no scrolling lists that
redraw constantly; prefer paging), no hover, large tap targets, high contrast, readable at arm's length, and full use offline.

Candidate routes, to be researched before choosing (none tested yet):

- **Android-based e-readers (Boox and similar):** the least hacking. They run a browser or an installed web app, and a kiosk or
  single-app launcher can hide everything else. Likely the first thing to try.
- **Kobo:** an open-friendly platform with a community of add-ons (KOReader, NickelMenu, an experimental browser); a custom
  front end is possible but more work.
- **Kindle:** needs a jailbreak on supported firmware, which is fragile across updates; the stock browser is limited. The
  hardest route.
- **reMarkable and similar Linux tablets:** open enough for custom apps, with a pen, which also brings back the parked "stylus
  drawing mode" from SPEC section 2.

Whatever the device, the server question in section 5 applies: the device either reaches the desktop's server, or carries the
database and study files itself.

## 7. Suggested order

1. Inventory: screenshots of every current screen and pane at desktop, laptop and phone widths (the app runs in a browser, so a
   narrow window shows what breaks today). Look for the FigCraft CLI.
2. Design system in FigCraft: type scale, spacing, colors (light, dark, e-ink), components (toolbar, verse, highlight, hover
   card or sheet, note, thread row, pane chrome, capture or palette).
3. Mobile layouts, with the Notebook as a first-class screen.
4. Desktop and laptop layouts: the current window refined, with the Notebook added.
5. E-reader layout for one chosen device, after the section 6 research.
6. Review with the person, then a SPEC revision and build plans for what is agreed.
