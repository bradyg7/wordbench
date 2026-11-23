# The Workbench: principles and every standing decision

**State:** draft, round 1 (2026-11-22) · No sheets of its own: the frames are the [identity](../identity/README.md)
demo's · **Review page:** `node design/review.mjs principles` (one row per conflict below, each with a notes box).

The person, 2026-11-22: "what does it look like to design this app in lieu of all the documentation of our current
designs? can we pull those into a combined principal document? and then go through and redesign/reapply those
conceptual and code decisions in this new framework?"

This is that document. It is read **first**, before any design folder and before [the Library map](../../LIBRARY.md)'s
details. It holds four things, in this order:

1. **Goals and rules**: what every feature is for, and the rules that keep it premium and orderly.
2. **The frame**: the new shape of the app (desks, bubbles, the dock, the tray, history, themes).
3. **Every standing decision, by area**: what is decided and still stands, one line each, with the folder and decision
   it comes from. The folders keep the detail and the history; this keeps the answer.
4. **Conflicts**: past decisions that break the new rules, each with a proposed resolution. **The person settles each
   one** (below); nothing that conflicts is redesigned or built until it is settled.

## Decisions (the person, 2026-11-22)

- **One principles document, the folders stay, linked.** Each design folder stays as the detailed record; this document
  is the one place that says what stands. Each folder gets a line at its top pointing here.
- **Conflicts are settled by the person, one by one.** Each conflict below has a proposed resolution; the person
  accepts, changes or rejects it before anything is redesigned.
- **The reader in a bubble comes first**, once this document is accepted: the Bible is the heart, and its bubble,
  marks on it and following a word set the pattern every other app follows.
- **Decisions are written down as they are made** and committed each time (identity, 2026-11-22).

## 1. Goals and rules

The goals G1–G5 and rules R1–R11 are written in full in [identity](../identity/README.md#goals-and-the-rules-that-keep-them-the-person-2026-11-22-round-3),
where they were decided; they hold for every feature. In short:

| | |
|---|---|
| **G1** Study deeply without losing your way | **R1** Nothing hides (columns, above and below) · **R11** One thing, one bubble per desk |
| **G2** Never lose anything | **R9** Everything can be turned back (history, branches kept) · **R3** Full means the tray |
| **G3** The text comes first | **R7** Controls are glass, reading is paper · **R2** A limit by screen, at most 4 × 3 |
| **G4** Premium in the hand | **R4** What you see while dragging is what you get · **R5** One spring · **R6** One gesture, one meaning · **R8** Never broken |
| **G5** Light everywhere | History keeps steps, not pictures; the phone keeps 14 days |
| (all) | **R10** Every action has a key and a `wb` command |

And the rules that never change ([AGENTS.md](../../../AGENTS.md)): scripture verbatim with its reference; no
interpretation; the study folder is the person's real work (scratch copies only); its formats are this app's to shape
but nothing written is lost; the Bible database is read-only; never lose the reader's place; designed before built;
every core action has a `wb` command; shipped means installed through the updater.

## 2. The frame

| Part | What it is | Where decided |
|---|---|---|
| **Desk** | A named, saved arrangement for one task (Sunday lesson, Word study: zeal). The desks line sits at the top in glass; switching slides the whole screen. | identity rows 15, 47–51 |
| **Bubble** | One opened thing on a desk: paper for its content, a glass title bar with ← → (its own history), its app's dot, its title, ↖ what led to it, ⋯, ✕. Columns of bubbles, above and below; never behind. | identity rows 17–28 |
| **Tray** | Pills at the dock's end for bubbles moved off a full desk; one click brings one back. | identity rows 29–31 |
| **Dock** | The apps, hidden at the bottom edge until wanted (or always shown, the Windows taskbar choice): Workbench (home), Bible, Notebook, Search, Words, Legend, Reading plans, then the tray, then Settings. | identity rows 5–10, 47–49 |
| **Workbench (home)** | Where you left off, today's reading, open questions, recent pages, every desk. | identity rows 11–12, 52 |
| **History** | The trail grown into the app's history: by bubble, by desk, by the whole app; a scrubber and a map; going back and acting there starts a branch. | identity rows 40–46 |
| **Full view** | A bubble grows over its desk for a moment and springs back (the person's question; settled in conflict X-19). | identity rows 55–57 |
| **Themes** | Twelve base themes, Sage the default; a page surface (Paper, Sepia, Night, custom) for reading only; the marks and folder colors are the person's own in every theme. | identity rows 1–4 |
| **Motion and glass** | One spring (stiffness 420, damping 34) for every move; liquid glass on the controls, paper under the text. | identity R5, R7 |

**Code that carries the frame** (identity, The codebase): the Rust core (`crates/wb-core`, `crates/wb-cli`, about 34,000
lines) and every `wb` contract stay. The new shell is built beside the old in `ui/src/shell/` (tokens, desks, bubbles,
dock, tray, history), switched on by a setting while it grows; each app moves into a bubble as its folder is
redesigned, and the old rail, panes and tabs are deleted as each app leaves them. Proposed files: `settings/desks.json`,
`history/<day>.jsonl`, `history/pages/<id>/`.

## 3. Every standing decision, by area

Each line is a decision that still stands under the new frame, in a few words, with its source. "→" marks where the
frame changes *where* it lives but not *what* it is. Conflicts are in section 4, not here.

### The Bible and the reader
- Scripture is the KJV, verbatim, from the read-only database; YLT is archived ([LIBRARY](../../LIBRARY.md)).
- A click on a verse number or a drag over words shows only the colors, small, beside the verse; a right click is one clean menu (reader A).
- What the person wrote sits in a margin beside its verse, names only, each a link (reader C); the margin is the verse's page (marks, 2026-11-12).
- A plain click on a word opens its card; the Concordance instead is a Reading setting (words W-2, settings).
- KJV+ (Strong's numbers in the text) is a reader view, its form still exploring (kjv-plus).
- → The reader is the **Bible app**; a second reader is a second Bible bubble (replaces reader R8's second reader in a pane).

### Marks and the Legend
- One family of marks on the text: highlight, underline (1–3 lines), circle, box, arrow (same chapter), margin note; a mark's kind and color are separate (marks).
- Drawn in a fixed order, highlight beneath, so a chapter with years of marks stays readable; Reading mode quiets them (marks T5).
- Files: `marks/<BOOK>.json`, `margin/<BOOK>/<chapter>.md`, `settings/legend.json`; old `highlights/` read as highlights, moved once only with the person's go-ahead (marks T15).
- The Legend names what each style means; up to 5 quick styles with keys Ctrl+1–9; Unnamed entries; where used; bulk delete (marks T3, T11).
- Every mark is findable by kind, color, Legend entry, book or date; a filter chip, not marks T12's controls (filters-v2).
- Arrows stay in one chapter, drawn in the gutter (marks T9).
- → **Legend is an app in the dock; marks are made anywhere** (the person, 2026-11-22).

### Words, the Concordance and the books
- The Concordance reads like the printed Strong's: English words A to Z, every place with words around it and the original number; Hebrew and Greek are its tabs (concordance C-1 to C-5).
- Forms (All forms / This word), counts, near: search owns how they are asked (concordance C-6).
- A dictionary entry shows every place, 4 lines a group and "N more" (C-3).
- The word card: lemma, sound, Strong's words, renderings, a count, one door "In the Concordance"; no pin (words W-4 to W-9).
- The verse card: Interlinear, In the Concordance, Definitions, labels never cut (words W-9).
- BDB and Webster's 1913 are books; one entry a page, ← → in number order (books A, exploring).
- → Concordance and lexicons are the **Words app**; an entry picked opens **beside** as a bubble (replaces C-13's new tab).

### Search and filters
- One box finds everything and takes commands; it also suggests (search B).
- Verses in results are whole, never cut (search).
- Counts by book with a Sections | Book by book switch (search).
- One filter-chip component for every list; every chip must match, values in one chip match any; no typed filters; chips apply at once; one `--filter "Status is Open"` form in every `wb` list (filters-v2).
- → The box is the **Search app** and Ctrl+K (conflict X-6).

### Pages and the Notebook
- Everything is a page (AGENTS); a page has no place; references in its text link both ways, found by themselves (marks, LIBRARY).
- The block editor, / menu, callouts (Question, Answered, Key point, Note), toggles, columns, the @ chip, Study blocks, Appearance, lock, Copy contents (notebook NB1–NB15).
- A list in a page is a database: a folder's pages as rows, page properties as columns, views and Group by (notebook rows 36, 47; filters-v2).
- The shell: side list as a page tree (Recents, Pinned, Folders, Pages; Templates and Trash at the foot), the page list as a table, open in place, the Trash as a popover (notebook-shell, accepted direction A).
- Only the focused empty line hints "Type / for a block" (fix, 2026-11-22).
- → The Notebook is an **app**: its side list and page live in one bubble; "open beside" is a new bubble (conflict X-8).

### Folders, saves and the library
- Save is K; a save points, never copies; one tree of folders holding pages and saves, nesting; one thing in several folders or none; saves in no folder are in **Unfiled** (library L-1 to L-3; LIBRARY Open 1).
- A folder may keep a color, shown quietly wherever its things appear; "thread" leaves the window, `wb thread` stays (threads TH-1 to TH-12).
- Thread files are not moved now; one designed, backed-up move later (TH-2, TH-12).
- A kept verse shows a ribbon at its number (library).

### Questions
- A question is a callout line (`> [!question]`, `> [!done]`) in a page or a margin note; one list with two doors (the one search, a saved list block); answering is a tick and the person's own line, never the app's (questions QN-1 to QN-8).

### Trash
- Deleting gives a toast with Undo (10 s one, 30 s several), then 7 days in the Trash; Erase now and Empty trash ask first; nothing else is erased; deleting a block stays out of the Trash (trash TR-1 to TR-5, AGENTS).

### Reading plans
- The plan leads the reader and the day is a checklist; Mark read · next is one step; missed days are a counter; Horner's ten lists ship; a part of a chapter read goes in the log; Reading is a place in the Library (reading-plans).
- → Reading plans is an **app**; its strip shows in the Bible bubble's bar (conflict X-13).

### Documents and tether
- A document is made from a page, a folder, a passage or a lesson; keeps its own choices; Word and PDF slides; the viewer pages with ← →; Looks from pictures; every verse checked, a failure keeps no file; where the file is, is said (documents DC-1 to DC-11).
- Tether finds the scripture a long page names or quotes (named and quoted only, never by meaning); evidence, never a score; nothing attached until Accept, one Undo (tether TG-1 to TG-15; backend built).

### Settings, Help, Keys, findings
- Settings is its own centred menu, not a tab; not every design is a setting (settings, 2026-11-13).
- Help is in that menu: Guide cards per task, Keys as a keyboard (help); the Try button postponed; Help comes last.
- A finding is kept from a small box (Ctrl+Shift+F), tagged with design folder names (findings).

### Updates, the site, the Mac
- Nothing installs by itself; a look sends nothing about the person; signed or thrown away; the version before is kept once; a copy built from source does not update; `wb update …` (updates U-1 to U-16).
- The site: Wordbench, free, Windows today, Mac coming; Releases from `docs/releases/*.md` (site S-1 to S-11).
- The Mac app ships unsigned first, universal dmg (mac M-1 to M-6).

## 4. Conflicts, for the person to settle

The interaction table below is the conflicts list, so the review page shows each with a notes box. **Proposed** is the
lead's suggestion; **Settled** is filled in only by the person.

## Interaction table

### The old frame (rail, panes, tabs)

| # | Where | Past decision | Breaks | What the person sees (proposed) | What changes on disk | `wb` command | Test | Settled |
|---|---|---|---|---|---|---|---|---|
| 1 | minimize | One rail for everything; rail icons by kind | The dock replaces the rail (identity) | The rail is retired. Its icons become the dock's apps; a "book" (Concordance, BDB, Webster's) is opened from the Words app, not its own rail button | None | none | — | [ ] |
| 2 | minimize | Minimized tabs and folder tabs on the rail | R1, R3 | Retired. A bubble moved off the desk is a **pill in the tray**; there are no minimized tabs | `settings/desks.json` tray | *proposed:* `wb desk tray` | — | [ ] |
| 3 | minimize, words W-4 | Floating panes and a card's float button | R1 | Retired. A card's float becomes **Open beside** (a bubble); the hover card stays a small popover that holds no work | None | — | — | [ ] |
| 4 | panels | A tab's title block scrolls away with the body; kind label; foot allowed; two head icons then More | R7 (bar is glass, floats over paper) | Kept as the **bubble's content template**: the kind label moves into the glass bar (the app label), the title block stays at the top of the paper, the foot stays, head icons become the bar's ⋯ | None | — | — | [ ] |
| 5 | tab-history | Each tab has a back button; a tab opened from another is a copy with its history | (agrees in part) | Each bubble has ← →. A bubble opened from another **starts its own history** and shows ↖ where it came from (not a copy of the other's history), so the two never share steps | `history/` steps | `wb history list --bubble` | — | [ ] |
| 6 | command | The top bar: back, forward, the place, the command box holding the front tab's line, the trail line, More | R7, the desks line | Retired as a bar. The **command box becomes Ctrl+K** (a glass box over the desk) and the **Search app** in the dock; the place lives in each Bible bubble's bar; back and forward are each bubble's ← →; the trail line is the history bar | None | `wb` commands unchanged | — | [ ] |
| 7 | command C18 | The box dragged off the bar to float | R1 | Retired (Ctrl+K appears where it is wanted) | None | — | — | [ ] |
| 8 | notebook-shell | Open beside: two pages at most; side peek from a list | R2 is the limit, R1 | **Open beside is a new bubble**, the desk's limit applies (not "two at most"); the side peek becomes a bubble beside | None | — | — | [ ] |
| 9 | concordance C-13 | A word picked opens in a new tab beside | (agrees) | Opens as a **bubble beside** the Concordance bubble (R11: if already open, it lights) | None | — | — | [ ] |
| 10 | settings | Layouts as a setting: a grid of saved layouts with keys | Desks | **Layouts become desks**: a saved layout is a desk; Settings › Layouts is retired; a desk can be given a key | `settings/desks.json` | *proposed:* `wb desk new` | — | [ ] |

### Where things show

| # | Where | Past decision | Breaks | What the person sees (proposed) | What changes on disk | `wb` command | Test | Settled |
|---|---|---|---|---|---|---|---|---|
| 11 | updates U-1 | The notice is a dot on the rail's Settings gear | The rail is gone | The dot and the download ring sit on **Settings in the dock** (and in the taskbar); with the dock hidden, one dot at the bottom edge where the dock rises | None | `wb update status` | — | [ ] |
| 12 | marks, threads TH-5 | The Legend on the rail; the reader's one marks panel (layers, eyes) | The rail is gone | **Legend is an app** (the person); the marks panel opens from the Bible bubble's ⋯ as a glass sheet over that bubble | None | `wb legend` | — | [ ] |
| 13 | reading-plans | The strip leads the reader; the checklist in a pane | Panes are gone | The plan's strip sits in the **Bible bubble's glass bar** while a plan is going; the checklist is the **Reading plans app** | None | `wb plan` | — | [ ] |
| 14 | tether TG-12 | Find scripture… opens the Tether pane as a tab beside the page | Tabs are gone | Opens as a **bubble beside** the page | None | `wb tether` | — | [ ] |
| 15 | documents DC-6 | The viewer; Present for the whole screen | Present vs full view | The viewer is a bubble; **Present is full view** (rows 55–57), with ← → for slides | None | `wb craft` | — | [ ] |
| 16 | help | The ? in a pane's head opens Help at its group | Pane heads are gone | The ? lives in each bubble's ⋯ ("Help with this"), opening Help at that app's cards | None | — | — | [ ] |
| 17 | findings | The finding box: small, in a corner, draggable | R1 | The one other **moment over the desk** besides full view: a small glass card that holds no study, gone when sent | `findings/` | `wb finding` | — | [ ] |
| 18 | search, library | The Library as a directory; the Library's lists (Margin notes, Highlights, Findings) | Apps and the dock | The Library's lists open from the **Workbench (home)** and from Search as bubbles; no separate Library pane | None | `wb find` | — | [ ] |

### The frame's own questions

| # | Where | Past decision | Breaks | What the person sees (proposed) | What changes on disk | `wb` command | Test | Settled |
|---|---|---|---|---|---|---|---|---|
| 19 | identity rows 55–57 | Full view covers the desk for a moment | R1 | Keep it as the **one named exception** to "nothing hides": the desk is only dimmed underneath and comes back untouched (findings' box, X-17, is the other moment) | None | — | — | [ ] |
| 20 | minimize, identity | The trail's sittings (a 30-minute gap starts a new sitting) and compaction with age | (agrees) | Kept **inside history**: the map and scrubber group steps into sittings; older steps fold by day (G5) | `history/` | `wb history sittings` (exists) | — | [ ] |
| 21 | AGENTS.md, ui/ | Literata for scripture, Inter for the interface; `tokens.css` | identity row 4 (face open) | Inter stays; the scripture face is chosen in identity row 4; `tokens.css` is regenerated from the twelve themes | `settings/look.json` | *proposed:* `wb settings look` | — | [ ] |
| 22 | minimize | Phone deferred; the desktop first | identity rows 45–46, 53 | The phone's form is designed with each app (cards, the dock shown), but built after the desktop | None | — | — | [ ] |
| 23 | LIBRARY.md | The words of the map | New words | Add to the map: **desk, bubble, tray, pill, dock, app, Workbench (home), theme, page surface, full view**; "trail" becomes "history" in the window (`wb history` already is) | `design/LIBRARY.md` | — | — | [ ] |

## 5. How each folder carries forward

| Folder | Carries | Why |
|---|---|---|
| books, concordance, words, kjv-plus | **Keeps** what it shows; moves into the Words and Bible apps | Behaviour and content are frame-free; only "opens in a new tab" and "float" change (X-3, X-9) |
| marks, highlights, threads, library, questions, trash, filters-v2 | **Keeps** | Data, behaviour and the `wb` contracts; where their panels open changes (X-12, X-18) |
| notebook, notebook-shell | **Keeps**, re-fitted | The editor is untouched; the shell lives inside the Notebook bubble (X-8) |
| updates, site, mac, documents, tether, reading-plans | **Keeps**, small moves | One placement each (X-11, X-13, X-14, X-15) |
| settings, help, findings | **Reskin** | Glass sheets in the new tokens (X-10, X-16, X-17) |
| reader, search | **Redesign** | Exploring folders, redrawn as the Bible app and the Search app; the reader first |
| minimize, tab-history, panels, command | **Retired into identity** | Their frame is replaced (X-1 to X-7); what stands moves here and into identity |
| identity | **The frame** | Goals, rules, desks, bubbles, dock, tray, history, themes |

## The order from here

1. The person settles the conflicts above (the review page has a notes box for each).
2. **The Bible app in a bubble** (the person's first choice): reader and search's exploring folders redrawn under the
   frame, with marks, following a word and the margin; its interaction table and frames from the demo.
3. Then the Library map's priority order, one app at a time: Words, Notebook, Search, Legend, Reading plans, Settings.
4. Building starts with the shell (`ui/src/shell/`) and the Bible app, ticket by ticket, behind a setting.

## Rounds

| Round | Date | What | Review |
|---|---|---|---|
| 1 | 2026-11-22 | The first draft: goals and rules (from identity), the frame, every standing decision from 31 folders, 23 conflicts with proposals, how each folder carries forward | pending |
