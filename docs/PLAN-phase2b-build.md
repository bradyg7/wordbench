# Phase 2b, step 5: what to build, in order (the handoff)

2026-11-04. For the session that builds phase 2b. The person accepted the design round
([phase2b-design.md](phase2b-design.md), second pass, section 7). This is the order to build it in, where each part goes,
and when it is done. Read first: [CLAUDE.md](../CLAUDE.md) (the rules), [PLAN-phase2b.md](PLAN-phase2b.md) (the phase),
[phase2b-design.md](phase2b-design.md) (the designs and the person's choices), and [phase2-results.md](phase2-results.md)
sections 10–12 (what the person's notes asked for, by id).

**Built so far in phase 2b:** step 1 (cards open on a click, hover off by default; 2ccf300), step 2 (KJV/YLT; f9c521d),
step 3 (a first reading plans pane, `wb plan edit`, `wb plan text`; 0c73afb). The step 3 pane is replaced by tier 3 below.

## For every item

- **A `wb` command for every new core action** (CLAUDE.md), with its case in `crates/wb-cli/tests/cli.rs`; the
  `every_action` test must still pass.
- **Checks in the real app:** new checks in `measure/desk.mjs` (`node measure/desk.mjs --release`, after
  `npx tauri build --no-bundle` and `cargo build --release -p wb-cli`); `npm run test:webkit`; `cargo test`;
  `python scripts/golden.py` when a command the Python `wb` also has changed.
- **Same files, same formats.** A new kind of file is written only where the Python app passes over it; say in the item
  which files change. Before a build that writes a new kind of file reaches the real folder, the person runs
  `scripts/backup-study.ps1` (it is the person's real work; see CLAUDE.md).
- **After each release build the person will use,** run `scripts/install-app.ps1` in the person's Terminal panel (not
  the sandboxed shell); it refuses while the app is open, so ask them to close it.
- **Record each item** in `docs/phase2-results.md` (the notes it answers) and tick it here.
- **Scripture verbatim** in tests and fixtures, from the database; no interpretation anywhere.

## Tier 0: small fixes from day 3 (one session, first)

Each is a day-3 note ([phase2-results.md](phase2-results.md) section 12). Small, and they get in the way now.

**Built 2026-11-04, all seven (✓ below);** what each does and how it was checked: [phase2-results.md](phase2-results.md)
section 13.

| # | Note | What | Where | Done when |
|---|---|---|---|---|
| ✓ 0.1 | `c35b` | The color bar closes, and the selection clears, on a click or tap outside it | `ui/src/main.ts` (`showBar`, the overlay's pointerdown), `ui/src/select.ts` | desk check: select, click away, no bar, no selection |
| ✓ 0.2 | `5a5a` | A write refreshes only the panes that show what changed; a pane keeps what is open (Days, a form) when it does refresh | `ui/src/app.ts` (`changed(kind)`), `ui/src/dock.ts` (refresh by kind), every `open*` in `ui/src/panes.ts` | desk check: plans pane with Days open, write a note, Days still open |
| ✓ 0.3 | `8c69` | A new pane opens in the column where a pane of its kind, or the pane it was opened from, already is | `ui/src/dock.ts` `open()` | desk check: move Threads left, open a thread, it opens left |
| ✓ 0.4 | `c440` | No terminal words in the window ("--books"); the books kind takes several books | `crates/wb-core/src/reading.rs` `KINDS` texts; `ui/src/panes.ts` plan form | the form says "The books you choose"; `gospels, rom` works |
| ✓ 0.5 | `e998` | Ctrl+J opens the Notebook's writing (focus in its box) from anywhere; in Keys | `ui/src/main.ts` keys; `openKeys` in `ui/src/panes.ts` | desk check |
| ✓ 0.6 | `c8dc` | Take a place off a note, its first place too: the next `also` place becomes its place; a note's last place taken off sends it to the Inbox | `crates/wb-core/src/store.rs` (beside `note also --remove`); `wb note unplace <id> <place>`; "Take off" on place chips in `ui/src/notebook.ts` and Notes & lookup | CLI test for each case; the Python `wb` still lists the note |
| ✓ 0.7 | `e48c` (decided 2026-11-04) | **Erase now** on a note or question in the Trash, asked to confirm; the only erase besides the 7 days | `crates/wb-core/src/store.rs` (next to the 7-day erase); `wb trash erase <name>`; the Notebook's Trash tab; **CLAUDE.md's rule** ("erased after 7 days … unless put back") gains "or at once with Erase now" | CLI test; desk check with the confirm |

## Tier 1: the dock (the foundation: cards as tabs, views and floats all stand on it)

Designs: D1 drop zones, D4 where new tabs open, V2 separate floats ([phase2b-design.md](phase2b-design.md) sections 3 and 7).

1. **Decide the base first** (PLAN-phase2b step 4.1): our dock (`ui/src/dock.ts`, ~475 lines) extended, or dockview-core.
   A short spike of each against the WebKit tests and the Compact size (a pane as a full screen with "Back to …" must
   keep working). Record the choice in PLAN-design.md.
2. **Drop zones** while a tab is dragged: left column, right column, a top band and a bottom band across the reader,
   split beside a pane, float anywhere else; each zone labeled (D1).
3. **Each float on its own** (V2): its own tab strip, moved, sized and minimized on its own; two floats join only when a
   tab is dropped on the other's strip; minimized floats wait as chips.
4. **Where new tabs open** (D4): beside the pane they came from (replaces 0.3's first step).
5. **Never lose the place:** every move keeps the verse at the top (the checks at Psalm 119:50 through every size stay).

*Done when:* desk checks for each zone, two floats moved separately, join by strip, reopen where they were; the phone
layout unchanged (WebKit tests).

## Tier 2: the Notebook, B (the main daily-use piece; two sessions)

Designs: N1–N4 (second pass) and B1–B2 (first pass). Files stay one note per Markdown file.

| # | What | Where | Files |
|---|---|---|---|
| 2.1 | **The list and the editor** (B1): the list (search; Group: Day, Chapter, Thread, None) and the open note as an editor: title (its first line), the format bar writing Markdown as plain text (headings, bold, italics, lists), places and threads as chips with + Place and + Thread | `ui/src/notebook.ts` (rewrite; the Journal/Inbox/All views become the groups), `crates/wb-core/src/notebook.rs` for the grouped lists | none new |
| 2.2 | **Places on chapters and books** (N1): + Place offers the verse, its chapter and its book | `crates/wb-core/src/anchors.rs`, `places.rs`; the place picker | a chapter is the run of its verses (`NUM.25:1-25:18`, already readable by the Python app); a book is the run of all its verses (`NUM.1:1-36:13`) |
| 2.3 | **Links** (N1): `[[title]]` and `[[title#heading]]` in a note open that note (or heading); **Linked from** under a note; renaming a note's title offers to update the links to it | `crates/wb-core/src/notebook.rs` (a link index from note bodies); `wb note links <id>`, `wb note backlinks <id>` | links are plain text in the body, so Obsidian reads them |
| 2.4 | **Today's page** (N2): one note per day, made the first time something is written in it; first in Group: Day | `notebook.rs`; `wb day [date]`, `wb day add -` | **new:** `notes/_days/<YYYY-MM-DD>.md`, no anchor (check the Python app passes over the folder, as it does `notes/_inbox/`); backup first |
| 2.5 | **Group by chapter, following the reader** (N3): the chapter being read, notes in verse order, chapter and book notes at the top; turns with the reader | `notebook.ts`, `notebook.rs` | none |
| 2.6 | **Quick capture** (B2, Ctrl+J from 0.5): a small box at the verse last clicked; Enter saves a short note, Ctrl+Enter opens it in the editor | `ui/src/main.ts`, `notebook.ts` | none |
| 2.7 | **Settings → Notebook** (N4): today's page, follow the reader, links, chapter and book places, the Inbox as its own group, the group it opens with, the capture key | the Settings window (built in tier 5; until then the More menu); `settings/notebook.json` | settings, per key |

*Done when:* desk checks per row; `python scripts/golden.py` still 99 of 99; the Python app still opens the scratch
folder and shows the notes; the person's notes of 2026-11-03 and 11-04 read correctly in the new list (on the scratch copy).

## Tier 3: reading plans, the form (A + presets), the plan (P), then the builder (C)

Designs: R1, A2, P1, P2, R2. Replaces the step 3 pane.

1. **The form** (R1, A2): Start from presets (Blank, Bible in a year, Old and New together, NT in 90 days, Psalms and
   Proverbs, A published plan…) fill its boxes; name and what to read required; books as chips with the Choose books
   grid (several at once, groups); Add a passage; order (Bible order, as listed, Old and New side by side), pace (my
   own pace with no dates, finish in N days or by a date, N chapters a day), start, days off; a summary before
   starting. `crates/wb-core/src/reading.rs`: kinds become options; new: no-date plans, days off, order as listed.
   `wb plan start` gains `--books MAT,MRK,…`, `--order`, `--pace`, `--days-off sun`. Plan files keep their fields; new
   fields are added, never renamed.
2. **The plan** (P1, P2): today's card (Read, Mark read); Days with ✓ and drag a day; when days are missed, four choices
   that each say what they do to the dates first: pick up where I left off (shift), fit them into the days left,
   leave them for later (to the end), skip them (marked skipped, not read). `wb plan missed <name> --shift|--fit|--later|--skip`;
   `wb plan move-day`. Each change keeps the old file in `.trash/` (as `plan edit` does).
3. **The builder** (R2), from the form's "Arrange the days myself…": chapters drag between days, days drag up or down,
   days set by hand are kept when the pace changes (a per-day `kept` flag in the plan file); Back to the form.
4. **Published plans** (note `032f`; the person's sources, 2026-11-04). None is shipped with the app (each is the
   publisher's: Guthrie's is "© 2011 George H. Guthrie"; Tyndale's One Year Chronological says "All rights reserved";
   Blue Letter Bible's and Professor Horner's are theirs). The person imports a copy they have, so the importer reads
   their forms: one day to a line (as now); **Guthrie's** Week N / Day N layout (six days a week: the seventh is a day
   off); **Blue Letter Bible's** list ("/" between places, its short names such as Jhn, Phl, 1Co, Jde); **Horner's ten
   lists** as a new kind: ten lists of books, one chapter from each list a day, each list starting again when done, no
   end date. Tyndale's day list is not on bible.com's page; it needs the person's own text. The plan file keeps the
   source's name.

*Done when:* CLI tests for each pace, order, days off and missed-day choice; import tests on small samples written for
the tests (not the publishers' lists); desk checks for the form, the grid, a drag in the builder.

## Tier 4: documents from a thread (PLAN-phase2b step 6, unchanged)

The Speaker Script (`.docx`, `docx-rs`) and the verse deck (PDF pages through Typst) from a thread with its notes, as the
person built on 2026-11-03 with the Python app; every verse checked against the database after rendering; `documents/`
keeps the Python app's format. This is what still sends the person back to the Python app, so it comes before the rest.

## Tier 5: views, the toolbar and My commands (Settings)

Designs: V1, D3, D2, TB1, TB2, S2.

1. **The Settings window** (S2's frame): Customize, Views, Reading, Notebook, Hover and cards, Theme, Keys; More ⋯ →
   Settings. Settings in `settings/*.json`, per key.
2. **Views** (V1, D3, D2): a view is where each pane goes (columns, bands, float), its name, key, shown in the View menu,
   its own toolbar or not; the View menu in the toolbar; Save this view…; `view <name>` in the command language and
   `wb view list|apply|save` (through `wb do` for the window). `settings/views.json`.
3. **The toolbar** (TB1): any pane, view or command line as a button, shown or hidden and in order; `{word}` and
   `{place}` take the reader's selection. `settings/toolbar.json`.
4. **My commands** (TB2): commands kept by the person, each with an optional key, and the most used, counted from
   `sessions/*.jsonl`. `settings/commands.json`; `wb commands`.

## Tier 6: threads, Help, the Shelf

1. **A thread: sort and filter** (T1): a filter field, All / Scripture / Notes, Sort (your order, Bible order, newest,
   oldest; drag only in your order). `ui/src/panes.ts` `openThread`; sorting in wb-core if `wb thread show` gains it.
2. **Help as a guide** (T2): Guide, Commands, Keys; an entry for every part of the window and every button; each
   pane's ? opens its entry; search. The guide's text lives in wb-core beside the manual (`wb guide [topic]`), so the
   window and a terminal show the same.
3. **The Shelf** (S1, SH1, SH2): sets in folders; an item's × takes it out; Open all, Close all; + Add (this tab, all
   tabs, a new note in the set, a note, place, thread, lesson or document); a set's open tabs carry its mark. Sets keep
   the Python app's file format; folders are a new field it passes over.

## Tier 7: a word's English definition (T3, note `0e98`)

Waits for the person's choice of source. Their candidates (2026-11-04): **Easton's Bible Dictionary** (M. G. Easton,
1897; public domain; CCEL has it as text and XML), the **Tyndale Open Bible Dictionary** (Creative Commons
Attribution-ShareAlike 4.0; a zip from tyndaleopenresources.com), and **StudyLight's list** (29 works; its pages say
"© 2001–2026 StudyLight.org", so a text would come from a copy whose own license is clear). **A question for the person
first:** the rule in CLAUDE.md is no commentary and no doctrine, and Bible dictionaries (Easton's, Tyndale's and most on
StudyLight's list) explain and teach as well as define. For an English word's meaning (the note's example: "envious" in a
Strong's entry), a general dictionary (Webster's, which StudyLight lists) or the King James Dictionary (words whose
meaning changed since 1611) stays a lookup. Once chosen: the text into its own read-only database file, built by a
script like the Bible's, shown verbatim with its source and license on every card; `wb word-define <word>`.

## After phase 2b

The phase 2b check (PLAN-phase2b section 2): a week of daily study, documents from a thread included, without the Python
app. Then phase 3, the phone (PLAN.md section 8), with the sync remote chosen at its start.
