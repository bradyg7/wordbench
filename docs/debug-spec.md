# Debugging spec and priority sheet (2026-11-08)

Written from the person's findings and notes in the real study folder, read only. **Nothing here is built.** No production
code was changed to write it. The items marked **REDESIGN** are not to be worked on until a design round is accepted.

**Read:** all 26 findings (`findings/`, 2026-11-06 to 2026-11-08, every one still `open` in the file) and the 45 notes
written or changed since 2026-11-04 (of 97), plus the older notes' still-open asks. The notes that are the person's own
study, and the test strings typed to try the editor (`hety`, `nothing`, `HellO`, `*text*`, `/`, `- sf`, the empty
template), are left out. Each item was checked against the code and `docs/phase2-results.md`: where an earlier round
already built it, it is in [Appendix A](#appendix-a-built-already-still-open-in-findings), not in the list.

**How an item is marked.** *Verified* = found in the code or a screenshot in this repo. *Hypothesis* = a likely cause that
must be reproduced before it is changed. Sizes: **S** under 2 hours, **M** half a day, **L** a day or more.

## The priority sheet

| # | Item | Finding or note | Size | Bucket |
|---|---|---|---|---|
| M1 | Blocks cannot be dragged by their grip (and, likely, nothing else HTML5-dragged works either) | `64c7` | M | **Must** |
| M2 | Scrollbars: thin, hidden until used, no arrows | `cd59` (and `3c78`, `0698`) | S | **Must** |
| M3 | Templates page and cards do not wrap, and scroll sideways | `bd54` | S | **Must** |
| M4 | A block being written shows a bordered white box | `6ed1` | S | **Must** |
| M5 | Second reader: a label that goes stale, a long note nobody wants, "Go to in the reader" as words | `b59b` (part) | S | **Must** |
| M6 | The keyboard's ↑ ↓ do not scroll a second reader (← → also move the main reader from it) | `b59b` | S | **Must** |
| S1 | The Notebook's side panel folds away | `c301` | S | **Should** |
| S2 | Fold all / open all for Threads, and Places grouped by book | `4c02`, `23f1` | S–M | **Should** |
| S3 | Right-click a page for its menu | `b737` (part) | S–M | **Should** |
| S4 | Slide arrows (← →) in the PDF preview | `a148` | S | **Should** |
| S5 | A thread's verses and words show on its page in the Notebook | `d84d` (part) | M | **Should** |
| S6 | Second reader parity: book and chapter picker, KJV/YLT switch | `b59b` (part) | M | **Should** |
| S7 | A finding records the build that is running, not the last commit | seen in `findings/` | S | **Should** |
| S8 | A clean filter for the Notebook (one-page design first) | `4463` | M | **Should, design sheet first** |
| C1 | Files attached to a finding | `b737` (part) | M | **Could**, built (§29): drop, paste and Browse; the handler stays off |
| C2 | Empty blocks left behind as stray Markdown (`>`) | seen in `notes/_inbox/…3fa7` | S | **Done 2026-11-08** (phase2-results §28) |
| D1 | Deletes destroyed with an undo (10 s; 30 s for a batch), and a delete-all-pages button: **decided 2026-11-08** | `cf09`, `0ade` | M | **Decided: build** |
| R1 | Everything is a page; threads, notes, questions become blocks or pages; the Threads tab goes | `38c2`, `7d00`, `d84d` (part) | L+ | **REDESIGN** |
| R2 | Shelf | `1d0e`, `3fa7`, `a484` | L | **REDESIGN (take up first)** |
| R3 | Documents: the Word, PDF and slide designs, a template builder, a viewer that matches the file | `868e` | L+ | **REDESIGN** |
| R4 | Customizable toolbar, a redesigned More ⋯, a Settings window, themes | `bc42`, `8810`, `c551`, `93b2` | L+ | **REDESIGN (designed once, confirm)** |
| R5 | A word's English definition | `0e98` | L | **REDESIGN, waits on a source** |
| R6 | After Listen finishes a chapter, offer Mark read | `2dcf` | S | **Won't now**: read aloud is phase 6 |

**Status, 2026-11-08:** M1 to M6 are built and installed (docs/phase2-results.md §26). M5's text size (90%) is the proposal, not yet the person's choice.
**Status, later 2026-11-08:** S1 to S7 are built (docs/phase2-results.md §27); S8's one-page sheet is drawn (`design/exports/filter/`) and waits for the person to accept it before anything is built. D1 and the redesigns are untouched.
**Status, late 2026-11-08:** C1 is built (docs/phase2-results.md §28): a drop, a paste and Browse… on the findings box, checked with a real OS file drop; Tauri's handler stays off. Not installed.

**Order:** commit what is built (W6 is not committed) → M2, M3, M4, M5, M6 in one session, since they are styling and small
UI → M1, which needs real mouse input to reproduce → S1, S2, S4, S7, S3 → D1 (decided), S8's sheet, S5, S6 → the
redesigns, R2 first (the person wrote "asap"), then R1.

## Rules that every item below keeps

From [CLAUDE.md](../CLAUDE.md), and the reasons the earlier rounds ran the way they did.

- Work on the scratch copy of the study folder (`scripts/scratch-study.ps1`, `WB_STUDY_DIR`), never the real one. Run
  `scripts/backup-study.ps1` before an installed build first writes anything new to the real folder.
- Any new action in wb-core gets a `wb` command, a case in `every_action.rs`, and, if the Python `wb` has the command, a
  golden case.
- No scripture typed by hand, in code, tests, fixtures or this document.
- **A desk check passes today for a feature that does not work.** `measure/desk.mjs` drags with Playwright over the
  DevTools protocol, which sends the web view synthetic events. M1 shows what that misses. Where an item below says
  *real input*, it needs one check by an actual mouse (or touch) in the installed window, as well as the desk check.
- Every fix ends with: its desk check, `npm run test:webkit` where it is layout, `cargo test` where it is core, a
  refreshed screenshot in `docs/phase2/`, and a line in `docs/phase2-results.md`.

---

## Must: broken or visibly wrong now

### M1. Blocks cannot be dragged (`64c7`)

**Symptom.** "draggable blocks in notebook doesn't work yet." The grip shows, the block does not move.

**Where.** `ui/src/blocks.ts:80–106` (the grip is a `<button draggable>`; `dragstart` sets `text/wb-block`; the block's
`dragover` and `drop` call `wb block move`). The desk check at `measure/desk.mjs:721–726` moves a block with
`locator.dragTo`, and passes.

**Cause (hypothesis, strong).** The window is built in `app/src-tauri/src/main.rs:238` without turning off Tauri's
drag-and-drop handler. On Windows (WebView2) Tauri's handler, on by default, takes the OS-level drag for file drops, and
HTML5 `dragstart/dragover/drop` inside the page then never run for a real mouse. Playwright's `dragTo` over the protocol
bypasses the OS drag, which is why the check passes. If so, **every HTML5 drag in the app is affected**, not only blocks:
the sidebar's page-onto-page drop (W3), a note dragged onto a verse, and a reading plan's days (`plans.ts`,
`dragTo` at `desk.mjs:1409`). The dock's tabs (its own pointer code) would be fine. Nothing in `ui/` or `app/` listens for
OS file-drop events (checked), so turning the handler off loses nothing.

**Second suspect.** The finding's context says `touch: true` (a convertible). A touch drag does not start an HTML5 drag.
Tell mouse from touch before concluding.

**Fix.**
1. Reproduce first, in the installed app with a real mouse: drag a block's grip, then a sidebar page, then a note onto
   a verse. Record which fail.
2. If all fail: `.disable_drag_drop_handler()` on the `WebviewWindowBuilder` (Tauri 2's name for it; confirm against the
   version in `Cargo.lock`).
3. If blocks still fail on a mouse, or only touch fails: move the block drag to pointer events (pointerdown on the grip,
   a ghost, the same upper-half/lower-half rule, the same `wb block move`), which also makes touch work.

**Done when.** A real-mouse drag moves a block and the file reads the new order; the same for a sidebar page. A desk
check that uses real input is added for one of them, so this class does not pass silently again.
*Touches the study folder:* no new fields. *Python app:* unchanged.

### M2. Scrollbars thin, hidden until used, no arrows (`cd59`)

**Symptom.** "scroll bars thin, and disappear if not used … the arrows at the top and bottom are also unneeded." Earlier
asks of the same kind: `3c78`, `0698` (2026-11-03). The screenshot `docs/phase2/1440-notebook-templates.png` still shows
the ▲ ▼ arrows on the reader's and the dock's scrollbars. *Verified.*

**Where.** `ui/src/style.css:13–23`. The rule `* { scrollbar-width: thin; scrollbar-color: … }` is the standard form, and in
Chromium it makes the `::-webkit-scrollbar-*` rules below it dead code (they sit inside an `@supports not` that is never
taken). The standard form cannot remove the arrow buttons or fade the bar.

**Fix.** Drop the standard properties; style with `::-webkit-scrollbar` (WebView2 and WebKit both read it): 8 px wide,
`::-webkit-scrollbar-button { display: none }`, a transparent track, a thumb that is transparent until the element has
`:hover` or a `scrolling` class that a single document-level capture `scroll` listener sets and clears about 800 ms after
the last scroll (scroll does not bubble, so listen in the capture phase). Keep the tokens' colors and the light/dark
`color-scheme`. Leave the tab row's hidden bar (`desk.css:119–120`) as it is.

**Done when.** No arrows anywhere; a bar appears while scrolling or hovering and fades after; the same in the dark and
light themes; a floating pane's resize corner (`desk.css:102`) is not covered. Desk check: computed style of the thumb
at rest is transparent; a scroll sets it. WebKit project at phone size.

### M3. Templates do not wrap (`bd54`)

**Symptom.** "templates doesn't text wrap very well." *Verified* in the same screenshot: the template cards are cut off
at the pane's right edge ("… asks for a place" runs out of the card) and a horizontal scrollbar runs along the bottom.

**Where.** `ui/src/desk.css:844–857`, the template list (`.nb-tpl-list`, `max-width: 680px`) and its cards; a card's
second line holds the "Read, What I noticed, Questions · asks for a place" summary on one line, and the card is a flex or
grid child with no `min-width: 0`.

**Fix.** `min-width: 0` on the card and its text column, `overflow-wrap: anywhere` on the summary, and the list as
`grid-template-columns: minmax(0, 1fr)`. Check the editing view too (`.nb-tpl-settings`, `.nb-tpl-row`: the "Names new
pages" value and its input at `width: min(320px, 60%)` can push past a narrow pane).

**Done when.** At the pane widths 320, 480 and 720 px no horizontal scrollbar, text wraps inside the card. Desk check:
`scrollWidth <= clientWidth` on the Templates page and a template's editor.

### M4. A block being written shows a bordered white box (`6ed1`)

**Symptom.** "when you write in a new block on a page, it pops up a border and a white text box. it should be like a
simple in line comment, much like notion's page editor."

**Where.** `ui/src/desk.css:349–350` and `:427`. The editing textarea is `.nb-input`, the same class as the old whole-page
box: a 1 px border, a `--surface` background, a card radius, and an accent border on focus. `.nb-block-input.nb-input`
only trims its size, so the box shows. (`.nb-write .nb-input` at `:513` already shows the borderless form the quick
capture box uses.) *Verified.*

**Fix.** `.nb-block-input.nb-input`: `border: 0; background: transparent; box-shadow: none; padding: 0;` the margins reset
so the text does not shift when a block goes into and out of editing; line height identical to the drawn block. The only
signal that a block is being edited is the caret (and, at most, a faint `--sunken` wash behind the block; no border). The
dashed "asking" state (`:428`) for the `/` menu stays, but as a hairline underline.

**Done when.** Clicking a block does not move any text by a pixel (desk check: the block's top and the first line's `x`
before and after); no border at rest or in focus; the three block kinds with their own chrome (to-do, table, fence)
still read. Screenshot before and after.

### M5. Second reader: stale label, a long note, "Go to in the reader" (`b59b`, the quick parts)

**Symptom.** Quoted: "the second text that shows the exact chapter that the reader was opened into (like if i opened 1
corinthians 13 … and changed the chapter, the text under it wouldn't change. i'd rather just remove the text entirely
underneath it)"; "no need for the second reader to have the 'a second reader…' comments"; "change the 'go to in the
reader' text to like a little arrow pointing to the reader as like (send to reader)"; "make the font a bit smaller."

**Where.** `ui/src/main.ts:662–674`. The head's second line is built once from the place the pane was opened with
(`t.label · ver · a second reader: clicks here never move the reader`) and is never redrawn when `turn()` changes the
chapter: stale, as described. The title above it is updated (`draw2`, `.reader2-title`). *Verified.*

**Fix.**
1. Delete the `pane-sub` line, both halves.
2. Replace the `Go to in the reader` text button with an icon button (an arrow toward the reader; `title` and
   `aria-label` "Send to the reader"); the verse's right-click item keeps its words (`main.ts:597`).
3. A smaller type size for the head and the second reader's text: ask the person which (the reader's own size setting
   already exists; a second reader at one step smaller is the proposal).

**Done when.** After ‹ ›, nothing in the pane names the old chapter; the head has the title, ‹ ›, the arrow and nothing
else; the arrow still moves the reader to the verse at the top of the pane (the behavior in `main.ts:666–669`).

### M6. The keyboard's ↑ ↓ do not scroll a second reader (`b59b`, answered 2026-11-08)

**Symptom.** The person: a user "needs to be able to use their up and down arrows on their keyboard to move the additional
reader text up or down, like how they can in the normal reader, but as of right now, it doesn't work that way."

**Where.** The main reader is `#scroller` and the second reader's scroller is its pane element (`main.ts:678`,
`scroller: el`). There is no arrow-key code for either: the main reader scrolls by the browser's own keyboard scrolling,
which needs a focused or last-clicked scrollable box. The selector takes the pointer for word selection
(`select.ts`: `selectstart` is prevented, pointer capture on the root) and the second reader's pane has no `tabindex`
and is never focused, so the keys have no scrollable target there. *Hypothesis, to confirm by pressing ↓ after a click
in each pane.*

**Fix.** Give the second reader's scroll element `tabindex="-1"`, focus it on a pointer-down inside it
(`focus({ preventScroll: true })`, so the click does not jump), and give it a visible-focus rule of none (a reader has no
focus ring). Let the browser scroll it natively with ↑ ↓ PgUp PgDn Home End Space once it has the focus; add a keydown
handler only if the native keys do not reach it (then ↑ ↓ scroll by one line height, PgUp/PgDn by a screen, Home/End to
the ends, and never while typing in a field or when the color bar's keys 1–5/0 are in use). The same must hold after a
pane is dragged to another column or floated, and after its chapter is turned with ‹ ›.

**Related, found while checking, not in the finding (asked in S6):** the global ← → handler (`main.ts:1063–1064`) steps the
**main** reader's chapter, even when the key was pressed in a second reader, which contradicts "nothing in it moves the
reader". Make ← → act on the pane that has the focus.

**Done when.** After a click on text in a second reader, ↓ and ↑ move that pane's text and not the main reader's; the
same in a floated second reader; the main reader is unchanged. A desk check by key presses (`page.keyboard`, which sends
real key events, so this one is not affected by the M1 gap) and one on the phone-size WebKit project is not needed.


---

## Should: next, small, clear

### S1. The Notebook's side panel folds (`c301`)
"need to make the side panel of the notebook minimizable." The wide Notebook's sidebar (`notebook.ts:516`, `drawSidebar`)
cannot be hidden. Add a fold control at its top that collapses it to a thin rail with an icon to open it again (and a
key); the main column takes the room; the state is kept in the window's storage, as the section folds are
(`notebook.ts:369–377`). The "wide when 640 px or more" switch (W3) must not fight it: a folded sidebar stays folded when
the width crosses 640 px and back. **Done when:** folded and opened by click and key; the page still lists nothing it
should not; narrow Notebook unchanged.

### S2. Fold all and open all: Threads, and Places by book (`4c02`, `23f1`)
"have a minimize all threads option in notebook"; "group chapters by books, and have minimize all." Folding a group by its
heading exists already (`929e`, W0). Add: one **Fold all / Open all** control at the head of any grouped list (Days, Places,
Threads) that folds every group at once and is kept the way each fold is; and in **Places**, the chapters sit under a
heading for their book (Bible order), the books fold, and a book's heading carries its count. The same applies to the
sidebar's Pages tree (a fold-all there too). *Core:* grouping by book is presentation, and can be computed in the window
from the entries' anchors; if a `wb notebook --group book` is added for a terminal, give it a golden-style CLI test.
**Done when:** 3 books with 2 chapters each list as 3 headings; Fold all leaves 3 lines; Open all shows 6; a reload keeps it.

### S3. Right-click a page for its menu (`b737`, first half)
"pages in the notebook viewer should be right clickable which can pull up options, like notion can." Today the options
are only under a note's own ⋯ (`notebook.ts:1296–1330`: Pin, A page inside, Move inside…, Make a document…, Save as a
template, Delete). Add a `contextmenu` handler on the rows of the tree, Pinned, the lists and the Trash's rows that opens
the **same menu builder** at the pointer (one menu, two ways to open it; do not write a second list of items). On touch,
a long press. Check it does not open on a block or a scripture block (those get their own, later, if wanted).
**Done when:** right-click on a tree row, a list row and a pinned row each show the menu for that page; Esc closes; Delete
there does what ⋯'s Delete does (D1: no question, a toast with Undo).

### S4. ← → through a PDF's slides in the preview (`a148`)
"would be nice if the document viewer allowed for pdfs … a left/right arrow to scroll through each slide." The preview
(`ui/src/pagedocs.ts:269–278`, W6, **not yet committed**) draws every slide in a column. Add a slide-at-a-time view with
‹ › buttons, the keys ← → when the pane has the focus, "3 of 9", and a way back to the column (a toggle). Keep the
column as the default for a Word file. **Done when:** the keys and buttons step through all the deck's slides and stop at
the ends; "N of N" equals the PDF's slide count (the check `wb docs preview` already makes).

### S5. A thread's verses and words show on its page in the Notebook (`d84d`, first half)
"why don't the verses in threads show up in that particular thread's page in notebook? only notes show up." The
Notebook's thread view (`notebook.ts:594–628`) lists `wb notebook --group thread`, which holds the thread's **notes**
only; the thread's places (verses, passages, words) live in `threads/<id>.md` and show only in the thread's own pane. Show
the thread's places in the same list, in the thread's own order, under the notes (or above, with a switch), each row the
verse verbatim with its reference (`wb text`-sourced; never typed), a click opening the verse card. **Core:** `wb thread
show` already returns the places; reuse it, no new file. This item is the part of `d84d` that is a gap in what exists, and
it stands whether or not R1 happens; if R1 is accepted, this view is replaced by it, so build only the read-only list.
**Done when:** a thread with 3 places and 1 note lists 4 rows; the verse text equals `wb text`; nothing is written.

### S6. Second reader parity (`b59b`, the rest)
Quoted: "add the same up/down arrow features … as well as making the top 'index' scripture button (the selector for other
chapters/books) also appear in the separate reader pane"; "it should have the exact same ylt/kjv implementation too, not
just a static kjv message."
1. **The book/chapter selector** (the main reader's toolbar picker, `.picker` in `desk.css:271–272`) in the second
   reader's head, scoped to that pane: choosing a chapter calls the pane's own `turn`-like function and never moves the
   reader.
2. **KJV | YLT** in the pane's head, per pane. Today `ver` is captured when the pane opens (`main.ts:625–660`), so a pane is
   fixed at the version it was opened with; the toolbar's KJV/YLT switch is the reader's only. Make it a per-pane
   state kept with the pane's key (`reader2|place|ver`, already in the pane's id) and redrawn in place; the YLT's own
   limits (no word positions, whole-verse highlights) are the reader's and are reused as they are.
3. The keyboard's ↑ ↓ are **M6**.
**Done when:** a second reader can go to any chapter and either version without the reader or the other second readers
moving; its text equals `wb reader … --version` for both.

### S7. A finding records the build that is running (seen in the data)
Every finding of 2026-11-08 says `d344b09` (or `71b1e84`), the last **commit**, although the window was running the
uncommitted W5 and W6 work (`phase2-results.md` §24–25: "built from the working tree on top of …"). So a finding's
`build` cannot tell which behavior the person saw, which already made `6ed1` (written against W3's editor, labelled
`71b1e84`) look as if it predated the editor. `ui/vite.config.ts:14` defines `__WB_BUILD__`; add `+dirty` (or the
install's own timestamp, `YYYY-MM-DD HH:MM`) when the tree has uncommitted changes. **Done when:** a finding written
from a build made on a dirty tree shows it. Findings already written are left alone.

### S8. A clean filter for the Notebook (`4463`), with a one-page design first
"i really just want to get a clear and user-friendly and clean filtering feature for the notebook." The pieces exist but
not as a filter the person can see: the sections, the Search box, the `@place questions days N thread pages` view
language (`commands::view_line`), and ⋯. Not a deep redesign, because the language is already the engine: **draw a
filter row above the list** (chips for Kind, Place, Thread, Questions open/answered, When) that writes and shows one view
line, so a filter is also a saved view. **Before building:** a one-page sheet in `design/` (the sheets are made by
`python design/workspace.py`) showing the row closed, open, with three filters on, and on a narrow Notebook, for the
person to accept. Held until R1 is decided only for the *Kind* chip (what kinds exist if everything is a page).
**Done when:** the row's result equals `wb view run "<its line>"`, and the line can be copied to a view block.

---

## Could

### C1. Files attached to a finding (`b737`, second half)
"the findings hot key could also allow for file attachments for inspiration/examples." New storage, so it is a small
design: attachments in `findings/<id>/` beside the finding's `.md` (the Python app passes over `findings/`; the Notebook
never lists it), copied in (never moved), with a drop zone and a paste of an image in the Ctrl+Shift+J box, listed on the
finding and in the Findings pane, and in `wb finding show`. Needs M1's drop-handling decision first (an OS file drop is
exactly what `disable_drag_drop_handler` would give up; the box would need a Browse button instead, or the handler stays
on and drops are read with Tauri's own file-drop event). Cap the size and say so. **Done when:** a PNG and a PDF attach,
open from the finding, and the `findings/` folder is the only place written.
**Built 2026-11-08 (phase2-results §28).** The decision answered itself: with Tauri's handler off, WebView2 gives the
page an ordinary HTML5 drop with the files in it, checked with the operating system's own file drag
(`measure/real-drag.mjs`, checks 3 to 5), so the box takes a drop, a pasted picture and Browse…, and the handler stays
off. 10 MB a file. `wb finding show | attach | detach | open`.

### C2. Empty blocks leave stray Markdown
`notes/_inbox/n_20261103204012_3fa7.md` holds a lone `>` line between its text and its scripture block: an empty quote
block saved as `>`. Blocks that are empty when their editing ends should be removed (the divider and table are the
exceptions), as an empty to-do or item already is. **Done when:** adding a Quote from `/`, leaving it empty and clicking
away writes nothing to the file. (The person's note stays as it is; this item does not rewrite it.)

---

## Decided

### D1. Deletes: destroyed, with an undo (`cf09`, `0ade`): decided 2026-11-08

Two findings: "deletes should not go to trash, they should just be destroyed" (`cf09`), and "would like a delete all button
for pages" (`0ade`). **The person's answer, 2026-11-08: destroy on delete, with an undo.**

**What it replaces.** The rule in CLAUDE.md: a deleted note waits 7 days in `.trash/` (2026-11-03: *"Delete should send
notes to a trashbin that auto deletes notes after 7 days"*), with Erase now added 2026-11-04. This reverses both. It is the
one change here that loses work for good, which is why it carries an undo, and a longer one for a batch.

**What is built (when this is taken up).**
1. **Delete** on a note, question, page, day's page or template asks no question for one item, and shows a toast
   **"Deleted “title” · Undo"** for 10 seconds. A multi-item delete (delete all pages, or a page with pages inside) is one
   toast and one Undo for the whole batch.
2. **How it stays safe.** The core still moves the file to `.trash/` first (`store.rs` `trash()`, `:512`): a crash or a
   closed window never loses the file between the click and the erase, and Undo is `wb trash restore`, which exists. The
   window **erases the item when the toast ends**, and on opening erases anything left in `.trash/` for more than a
   minute (replacing today's 7-day sweep for notes, questions, pages and days). Restoring a page puts it back in its
   parent, its place and its `order`, and the pages that moved up a level when it was deleted go back inside it (the
   delete rule of W3 in reverse; this is the part that needs a test).
3. **The Trash goes from the window:** the Trash button, its list, Put it back and Erase now are removed, since nothing
   waits there. `wb trash`, `wb trash restore` and `wb trash erase` stay for a terminal and for the files that are not
   notes.
4. **From a terminal** `wb note rm` has no toast: it moves the file and says "erased at the next sweep; `wb trash restore
   <name>` until then"; `--now` erases it at once.
5. **Not changed:** everything in `.trash/` that is not a note, question, page or day (threads, highlight files, plans,
   documents' records, `reading-unmarked.jsonl`) keeps its present handling and is never erased. The Python app's
   `.trash/` naming stays, so it can still read what is there.
6. **CLAUDE.md** is edited to say it, with the date, in the same change; the person approves that edit (it is a rule of the
   repo), so it is shown in the diff and not made quietly. The Python `wb note rm` keeps files in `.trash/`: recorded in
   `docs/phase1-results.md`'s list of deliberate differences, and the golden case adjusted.

**Done when.** Delete then Undo restores the file byte for byte, with its parent, order, pin and place. Delete and waiting
10 seconds leaves nothing in the study folder or `.trash/`. A page with two pages inside, deleted and undone, has them
inside it again. Closing the window inside the 10 seconds leaves the file in `.trash/`, which the next open erases. The
window has no Trash. A desk check for each, and CLI tests for restoring a page tree and for `--now`.

**`0ade`, Delete all pages.** Now unblocked. A command in the Pages heading's ⋯ and `wb page rm --all [--yes]`: one
confirm that names the count ("Delete 12 pages and the 3 inside them?"), done as **one operation** (twelve single deletes
would rewrite parents as they go), with templates, Pinned pages and days left out unless ticked in the confirm, and one
Undo for the whole batch. The Undo is the only safety here, so a batch gets **30 seconds**; an empty list is refused.

---

## REDESIGN: do not work on these yet

Each is a change of model or of a whole surface. For each: what the person said, why it is deep, what it touches, and
the questions the design round has to answer. Until the person accepts a sheet, nothing in this section is built.

### R1. Everything is a page (`38c2`, `7d00`, `d84d`)

**Said:** "we need to get rid of 'notes'. everything needs to appear as a page, even notes in threads. this will require a
relook at how threads are compiled and designed" (`38c2`); "if the notebook became just pages, then threads, questions,
notes etc. were different block options within a page … `/?` for question and `/note` … `/~` for threads" (`7d00`); and
"the separate threads tab adds any value at all now, it just seems like legacy stuff … allowing for just threads to appear
as pages, and their features present within their pages" (`d84d`). Earlier notes lead the same way: `05f3` and `f4ac`
(the Notebook as the staging area for lessons), `6572` and `4ad9` (notes on a thread).

**Why deep.** It changes the data model, not a screen. Notes today have kinds (`verse`, `word`, `phrase`, `verses`, `jot`,
`thread`, question, day) and live in folders by book (`notes/<BOOK>/`), `_inbox/`, `_threads/`, `_days/`, `trails/`;
threads are their own files (`threads/<id>.md`) holding places and words, and documents are made **from** a thread
(tier 4's plan reads a thread's places, words and notes). Making a thread a page changes what a document's source is,
what the fingerprint hashes (`scripts/doc-plans.py` compares it to the Python app's, 6 of 6 today), and what the Python
app can still open. It also meets the rule that both apps open the same folder.

**What the design must answer.**
1. Is the *file* a page for everything (a verse note becomes a page with a place), or only the *window*? The second
   keeps the folder as it is and is far smaller.
2. What is a thread as a page: a page with blocks of scripture, words and notes (so the thread's places become scripture
   blocks, which W4 built)? Then the Python app's thread files need a read-through and a write-back.
3. What happens to a document built from a thread: its source becomes a page (W6 already makes documents from a page),
   and the thread-sourced records keep working until they are rebuilt.
4. What a question is as a block (`/?`), with Answered, and whether a question still lists in Questions and in Notes &
   lookup (`c39a`).
5. Where a word study goes (Strong's, renderings): a block that holds a word, with its definitions (R5).
6. Migration: nothing rewritten without a backup, a dry run, and the Python app still opening the result.

**Prerequisites that are not redesign and can go first:** S5 (a thread's verses listed on its Notebook page), S8's filter
row. **Not to build before this is decided:** the Threads tab's removal, a rename of "notes", any `/?` or `/~` block.
This is also where the findings `d84d` (second half), `b737`'s Notion-style menu and `4463`'s *Kind* chip meet.

### R2. The Shelf (`1d0e`, `3fa7`, `a484`)

**Said:** "shelf needs to be figured out asap" (`1d0e`); "would be really cool if the 'shelf' was like a file organization
system, similar to how obsidian organize files" (`3fa7`); "why can i click a particular tab in a set in my shelf, but not
actually open the whole set of tabs (which was the original intended goal)" (`a484`).

**Status.** A design exists: tier 6 item 3 of `docs/PLAN-phase2b-build.md` (sheets S1, SH1, SH2: sets in folders, an item's
× takes it out, Open all, Close all, + Add, a set's open tabs carry its mark; folders a new field the Python app passes
over). It is **not built**. The only fault in the current Shelf the notes name is that a set cannot open all its tabs, which
is the tier's *Open all*. So the first question is not a redesign but a check: **do those sheets still say what the person
wants after the Notebook's rework?** If yes, it is a build (L, in its own session, with a backup first because it adds a
field to `sets/`). If the person wants it *as a file tree* (Obsidian's), that is a design round of its own, and the
sheets need redrawing around folders that can hold sets, pages, places and documents.
**Take this up first among the redesigns** because it is the one the person marked urgent.

### R3. Documents: designs, a template builder, a viewer that matches the file (`868e`)

**Said:** "seems like the document viewer for docx doesn't load the same as the actual docx shows, but i much prefer the
in-app viewer and style of the docx over the original python app design. would be great if we scrapped those designs of
the docx and pdf/pptx slides, and actually did an in-depth design spec of what those will look like (and if there can be a
document template builder, similar to the notes, or what-have-you)."

**Two things in it.**
- *The viewer and the file differ.* True by construction: `wb docs preview` draws a Word file's paragraphs in their styles
  from the file itself (a simplified layout), and Word lays it out itself (page size, margins, fonts: the themes' Word
  fonts are not on every computer, `phase2-results.md` §21). The person likes the **in-app** look. So the real question is
  not "make the preview match Word" but "make the file look like the preview". That is a new design of the Word styles.
- *A new design spec for the documents, and a template builder.* Today's designs are the Python app's WordCraft/DeckCraft
  (themes, structures: Speaker Script, Verse by Verse built; Share Copy, Study Sheet, Reading Sheet, Reader, Pulpit,
  Study Table greyed "phase 5"). The person is asking to **replace** them.

**Why deep.** It re-decides the output of tier 4 and W6 (`docs/plan.rs`, `docx.rs`, `deck.rs`, `page.rs`), whose
fingerprints are shared with the Python app so that both agree a document is up to date (the person's own
2026-11-03 documents were made by the Python app). Changing the design breaks that agreement on purpose, so the Python
app's decks and documents become the old format. A document *template builder* is the notes' templates idea applied to
layout, which is a new editor.

**What the design round must answer.** Which structures survive; the Word styles and the slide boxes drawn on sheets the
way `design/workspace.py` draws the windows, with the same scripture on them (from `design/content.json`); fonts that
travel (Literata and Inter are bundled; the Word file needs them embedded or substituted); whether the template is
chosen per structure, per page or per theme; what a block becomes (W7.2 already says); and whether the PDF deck is what
replaces PowerPoint (the answer so far is yes).
**Not to build before this:** S4 is independent (it only pages the preview), and fine.

### R4. A customizable toolbar, the More ⋯ menu, a Settings window, a person's own theme (`bc42`, `8810`, `c551`, `93b2`)

**Said:** "the more button needs a redesign, and the customizable settings bar needs designed tool" (`bc42`, 2026-11-08);
earlier: a customizable top bar (`8810`), the whole command bar, themes and the Shelf's functions customizable (`c551`),
and colors "just as in depth as our other custom features" (`93b2`).

**Status.** This is tier 5 of the build plan (Settings window S2; views V1, D3, D2; toolbar TB1; My commands TB2; a
person's own theme in `settings/theme.json`), drawn but not built, so More ⋯ still holds what grew into it. It is large,
and `bc42` says the *design* of the customize tool is not settled ("needs designed tool"), so the first step is again a
check of the existing sheets, not a build. Depends on nothing else; touches `settings/*.json` (new files the Python app
passes over). Notebook-side, the ⋯ was already cut to what acts on the Notebook (W1, `e09e`); this item is the *app's* More.

### R5. A word's English definition (`0e98`)
Tier 7. Waits for the person's choice of source: Easton's, Tyndale's, or a general dictionary (Webster's, the King James
Dictionary). CLAUDE.md's rule — *no commentary, no doctrine* — decides which: a Bible dictionary explains and teaches,
which the rule forbids; a plain dictionary defines. The card's *Definitions* tab already says it waits for this.

### R6. Mark read after Listen (`2dcf`)
Not built here on purpose: `listen` is read-aloud, phase 6. When it comes: at a chapter's end, offer Mark read. Recorded
so it is not lost. Won't be worked now.

---

## Waiting on the person, not on code

| | Item | What is needed |
|---|---|---|
| W-1 | `28d3` (touch: the on-screen keyboard drops when the note button is pressed in tablet mode) | Try again on the current build in tablet mode; if it still drops, write a finding at that moment (Ctrl+Shift+J records the input and size). Emulated touch showed no blur, so it cannot be reproduced from here. |
| W-2 | `032f` a chronological reading plan | Which published plan, from what source (the app ships none whose order is a judgment). |
| W-3 | `0e98` dictionary | R5's choice. |
| W-4 | Mark handled | Every finding in Appendix A is still `open` in `findings/`; marking them handled is the person's (Findings → ✓ Handled), not done from here. |
| W-5 | Word and PDF made by the Rust app | Open a Speaker Script in real Word and a Verse by Verse PDF, before trusting them (the plan's rule); it is also what R3's first question needs. |

## Appendix A: built already, still open in `findings/`

So nothing in the folder reads as undone that is done. Build and check are in `docs/phase2-results.md`.

| Finding | Asked | Built in | Where in the results |
|---|---|---|---|
| `ad58` | the `[[` list cleaner, scrolling | W0 | §19 |
| `707d` | findings box draggable | W0 | §19 |
| `929e` | groups minimizable | W0 | §19 (S2 adds fold-all) |
| `c7ab` | retire or rename the Inbox | W1 | §20 |
| `e09e` | re-examine the ⋯ settings | W1 | §20 |
| `94a1` | open one verse from a note, with interlinear and Strong's | W4, the verse card | §23 |

The notes of 2026-11-03 to 2026-11-05 are all built, handled or placed in a tier (`phase2-results.md` §10–§16), apart
from the ones that appear above (`a484`, `3fa7` → R2; `8810`, `c551`, `93b2` → R4; `0e98` → R5; `032f` → W-2; `28d3` → W-1).
`2dcf` is R6.

## Appendix B: the findings and where each went

| Finding | Item | Finding | Item |
|---|---|---|---|
| `ad58` | built (A) | `bd54` | M3 |
| `94a1` | built (A) | `bc42` | R4 |
| `2dcf` | R6 | `c301` | S1 |
| `707d` | built (A) | `b59b` | M5, M6, S6 |
| `c7ab` | built (A) | `d84d` | S5, R1 |
| `929e` | built (A) | `a148` | S4 |
| `e09e` | built (A) | `868e` | R3 |
| `6ed1` | M4 | `0ade` | D1 |
| `cf09` | D1 | `64c7` | M1 |
| `b737` | S3, C1 | `4c02` | S2 |
| `38c2` | R1 | `23f1` | S2 |
| `7d00` | R1 | `1d0e` | R2 |
| `4463` | S8 | `cd59` | M2 |
