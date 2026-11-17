# Marks

**State:** accepted by the person 2026-11-17 (ready to build); was exploring (round 6 drawn 2026-11-16) · **Sheets:** `python design/features/marks/marks.py` writes `marks.figcraft` and `marks.pdf` (the board, one vector page)
(it uses [kit.py](../kit.py)) · Nothing here is built yet. What other tools get wrong, and so what this folder avoids:
[bible-software-complaints](../../research/bible-software-complaints.md) (theme 3: margin notes lost; theme 6: the
reading screen crowded; theme 8: the place lost).

**Readiness: likely finished** (2026-11-16, the Notebook pass, by [ready-criteria](../ready-criteria.md)); the person
accepted it on 2026-11-17, with the recommendations on the margin's files (MK-17), moving old placed notes (MK-18) and
history (MK-19). Inferences first: MK-1 to MK-16, which close rounds 2-5 (not reviewed by the
person) from the person's dated words of 2026-11-12; MK-3 (M26 as the reader's margin), MK-8 (grow, not move) and
MK-12 (Margin notes as the Library's fifth piece) carry the most.

- **1** one direction per part; M2-M5, M8-M11, M16, M17, M20, M24, M29, M41 off the board (it shows M6, M7, M12-M15,
  M18, M19, M21-M23, M25-M28, M30-M40, M42-M44 only, read from `marks.figcraft`).
- **2** every open question struck (rounds 2 and 3, closed by MK-1 to MK-10); "Needs the person" 1-3 were
  study-folder formats or a move of the person's files, each with a recommendation; decided by the person 2026-11-17
  (MK-17 to MK-19).
- **3** M42-M44, M12, M23, M36-M40 drawn. **4** every line names inputs and a result; the reader's place is its own
  line.
- **5** existing commands named; `wb margin …`, `wb page overview`, `wb hl pencil`, `wb anchor --pages`,
  `wb study check --margin-move` named as required.
- **6** [overlaps](../overlaps.md) rows on the margin, underlines, places, Margin notes in the Library and too many
  highlights are resolved or agree, with highlights the owner of layers and Reading mode (MK-15).
- **7** agrees with `AGENTS.md` (pages lose their single place, marks 2026-11-12; a fence holds an id, MK-8); the
  jot fence is a new fence kind, so it was part of "Needs the person" 1 (decided: MK-17).
- **8** fixed on this pass: the data table named `rom10-2.json`, which the sheets no longer use; the record below is
  marked as superseded where it differs. Scripture from `data/*.json` via `K.fetch` (`marks.py:19`, `:435`, `:852`);
  what the person wrote is a placeholder.
- **9** no prompt or suggestion (MK-10); MK-13's order is a fixed rule, not a judgment. **10** formats and the move
  were "Needs the person" 1-3, with the migration steps written; decided by the person 2026-11-17 (MK-17 to MK-19).
  No file of the person's is moved by the decision: the move (MK-18) happens once, designed, tried on a scratch copy
  after a hashed backup (`scripts/backup-study.ps1`), with the person's go-ahead.

The person answered "Needs the person" 1-3 and accepted M26 and M25 (the reader's margin and the verse opened in it),
M27, M28, M32-M35 (margin notes and pages), M30, M31 (in the Library), M22, M23 (Scripture in this page), M13-M15
(lines on the words), M6, M7 (a passage with your marks), M21 (filters), M42-M44, M12 and M36-M40 on 2026-11-17.
M18, M19 follow MK-19: dates are kept from the start; earlier versions of pages are not kept yet.

What "a mark" is, how marks relate to pages, the reader's margin, the Library and the questions list. Asked by the
person on 2026-11-12, after questions round 2: questions look like a kind of marking beside the text, and it was not
clear whether marks replace notes, whether they only stick to scripture, whether a page can bring in a passage with
its marks, or how a list of them fits the Library. "Mark" is already the word: `wb marks` ("what is drawn on a
chapter"), and the reader's one panel for "every kind of mark" (reader R7, decided).

In this README "jot" is the design's short word for a **margin note**; the window says "margin note".

## Leading design (2026-11-16)

The board (and its PDF) holds only these windows, grouped by part. Superseded windows are in git history (commit
`0d59600` before the first trim, `b875cd4` before this one); their lines below say what replaced them.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| The margin: the verse's page and store | M25 (opened), M26 (names first, lines on hover), M27 (writing asks where), M28 (passages and chapters) | M2, M3 (by M26, M27), M4 and M9-M11 (by the margin decision and M25), M29 (by M32) |
| Margin notes and pages; Margin notes in the Library | M30-M35 | M32's line "Getting long: grow it into a page?" (by MK-10) |
| A page's scripture overview | M22, M23 | M1's model (by the no-places and margin decisions); M24, "Not a tether" (by MK-6) |
| Marks on the words | M13 (one line under a run), M14 (the pencil), M15 (a saved phrase: the folder's color) | M5 (by M13-M15); M16, your own styles (left to [highlights](../highlights/README.md), MK-1); M17, the dotted line (dropped, MK-2) |
| A passage with its marks | M6, M7 (the photograph) | |
| History (MK-19: dates are kept; what needs earlier versions of pages waits for their own design) | M18, M19 | |
| Filters | M21 (one menu in the search field) | M8 (chips; not liked by the person); M20, a side list of kinds (by MK-4) |
| The real conditions | M42 (among other tabs), M43 (floating), M44 and M12, M23 (narrow), M36-M40 (years of study) | M41, the Pages tree (by [library](../library/README.md) S36, MK-12) |

## Decisions (2026-11-16)

Each is **decided by overseer from existing decisions (inference)**, dated 2026-11-16, on top of the person's
decisions of 2026-11-12 below (no places, only tethers; the page's scripture overview; the margin is the verse's page
and store; writing in the margin asks; questions are a filter of the Library's search; a passage with your marks).

| # | Decision | Rests on |
|---|---|---|
| MK-1 | **Underlines:** one joined line under a run (M13). Two kinds are built: the pencil (M14: grey, thin, U) and a saved phrase (M15: the color of the folder it is saved in, two lines at most, the hover names every folder). Your own styles (M16) is not rejected; it is [highlights](../highlights/README.md)' question ("styles beside colors") and leaves this board. | The person, round 1 review ("not necessarily at odds"; one line under a run); [threads](../threads/README.md) TH-1, TH-6 |
| MK-2 | **The dotted line is dropped** (M17's D1). The margin already says something is written at a verse (M26), and the person found the dotted line clashing with the pencil. No window draws it. | The person, round 1 review (M6, M7) |
| MK-3 | **The reader's margin is M26:** names first (a mark and "2 notes · 3 pages"), their lines on hover, the verse opened in the margin (M25) on click. | The person, round 1 review (Q3: "R6 as the first view, perhaps mixed with M2") |
| MK-4 | **Filters are one menu at the start of the search field** (M21). It is the same line the library's S27 and S21 draw; a side list of kinds (M20) would be a second filter and takes room a narrow pane does not have. | The person (chips not liked); library L-8 |
| MK-5 | **The overview is named "Scripture in this page".** In a pane at least 560 px wide it is open at the top of the page, at most 6 rows high and scrolling (M22); narrower, it is one wrapping line that opens the list (M23). The book button in the pane's head brings it back after scrolling. It is not a setting. | The person, 2026-11-12 ("a scrollable overview, *Scripture in this page*"); index ("A design choice is not a setting") |
| MK-6 | **Every reference in a page counts.** "Not a tether" (M24) is not built: it would need a marker written into the page's text, and the tool for a crowded verse is the fixed order of MK-13. It can be designed later. | The person, 2026-11-12 ("found from its text"; "fewer, less redundant references") |
| MK-7 | **A margin note on a passage or chapter** sits in that passage's or chapter's margin with a bracket beside its verses; a verse's margin lists the notes that cover it, smaller (M28). | The person, 2026-11-12 ("a note on a verse, a passage or a chapter") |
| MK-8 | **A margin note grows into a page; it is not moved.** Grow into a page starts a page whose first block shows the note (a ```` ```jot ```` fence holding only the note's id, as a thread or word fence does); the note stays in the margin with "grew into Phinehas" under it. Add to a page… does the same into a page that exists. Deleting the page leaves the note (M32-M35). | The person, 2026-11-12 ("making a page out of a thought, or attaching it to an existing page"); `AGENTS.md` (a fence holds an id, never the text) |
| MK-9 | **The margin is keyed by a verse, a passage or a chapter.** A note written with words selected is a note at that verse that names the words. A Strong's number has no margin: the pages that name H7065 are listed on the word card ([words](../words/README.md) W-5). The three "pros and cons" tables below are closed by this and by the margin decision. | The person, 2026-11-12 ("a verse, a passage or a chapter"); words W-5 |
| MK-10 | **The margin never prompts.** The line "Getting long: grow it into a page?" is removed; Grow into a page is in the note's menu only (M32). | `AGENTS.md` ("nothing suggested") |
| MK-11 | **A margin note can be a question:** the same callout line as in a page, in one list ([questions](../questions/README.md) QN-1). | The person's questions decision B; questions QN-1 |
| MK-12 | **Margin notes are the Library's fifth piece** (Page, Folder, Save, Margin note, Library): a folded row at the foot of the side list, opening the Bible's order with counts (M30, M31, M38). Never filed in folders, never pinned. The side list itself, the Pages tree and the one search are the library's (S25, S36, S21); M41 leaves this board and M40 only shows margin notes inside that search. | The person, 2026-11-12 ("the margin should have its own place in the Library"); library S20 |
| MK-13 | **A crowded verse (strain 2):** the pages that name a verse are ordered by a fixed rule, not a judgment: pages that hold the verse in a scripture block first, then by how many times the page names it, then newest. Grouped by folder past 20 (M37). | Round 5, strain 2 |
| MK-14 | **Speed is part of the design (strains 3, 4):** the cache indexes verse → pages and verse → margin notes and is updated one file at a time on save; opening a chapter never reads page files. | Round 5, strains 3 and 4 |
| MK-15 | **The margin obeys its eye** in the reader's one marks panel (reader R7). Whether a quiet Reading mode also turns that eye off is [highlights](../highlights/README.md)' to say; marks follows the panel. | reader R7 (decided) |
| MK-16 | **A passage in a page** has the switch Just the text · With my marks; with marks: colors and pencil on the words and one dot per verse that has something, a click opening a small card in place (M6, M7). "As of a date" belongs to history (was "Needs the person" 3; now MK-19) and is not built from this design. | The person, 2026-11-12 (answer 3; "the photograph is liked") |

## Decisions (the person, 2026-11-17)

Each is **decided by the person 2026-11-17 (accepted the recommendation)**: the overseer's recommendation under "Needs
the person", accepted as written. None of them moves or rewrites a file the person already has: a move of the
person's files happens once, designed first, tried on a scratch copy after a hashed backup (`scripts/backup-study.ps1`), and only
with the person's go-ahead for that run.

| # | Decision | Rests on |
|---|---|---|
| MK-17 | **How margin notes are kept on disk:** one Markdown file per chapter, `margin/<BOOK>/<chapter>.md` (for example `margin/NUM/25.md`), each note under a line naming its verse, passage or the chapter, with its id and the date it was written; a question is the same callout line as in a page (`> [!question]`, `> [!done]`); a page's seed block is a ```` ```jot ```` fence holding only the note's id. Reasons: at most 1,189 files however long the person studies; a chapter's notes read top to bottom in the Bible's order in any editor; one file changes when one note changes. Main risk named in the recommendation: two notes edited in one chapter on two devices touch the same file once sync exists. This is a new form for new margin notes; it moves nothing already written. | The person, 2026-11-17 (was "Needs the person" 1) |
| MK-18 | **Moving the old notes that have a place, once:** a placed note that is only plain sentences (no title, heading, block, table or page inside) becomes a margin note at its place (in MK-17's form); any other becomes a page whose first line is its reference. Before anything is written, a read-only list says which each note would become (`wb study check --margin-move`); then a scratch copy, a hashed backup (`scripts/backup-study.ps1`), and the person's go-ahead for the run on the real folder. Old trails at a verse move in the same pass ([questions](../questions/README.md) QN-8). Until then the app reads the old form: a placed note is shown in its verse's margin as it is. Main risk named in the recommendation: a short note the person thinks of as a page lands in the margin; Grow into a page (MK-8) is the way back, and the list shows it first. The rule is decided; the move itself has not been run, and this decision runs nothing. | The person, 2026-11-17 (was "Needs the person" 2); the person, 2026-11-12 (a page has no place; old notes move once with the go-ahead) |
| MK-19 | **History (M18, M19):** keep the date on every margin note (in MK-17's form) and on every highlight (how is [highlights](../highlights/README.md)' own format question, still open there), and do not keep earlier versions of pages yet. Dates are small and make M18's line of dots true; versions of every page would grow the folder and need their own design (where, how long, how erased). Main risk named in the recommendation: thoughts edited before versions exist cannot be shown as they were. Nothing else on the board depends on M18 or M19. | The person, 2026-11-17 (was "Needs the person" 3) |

## Decisions made while building (the builder, 2026-11-17, inference, for the person's look)

The accepted design left these open; the build chose the smallest answer that keeps what the person already has. Each can be changed.

| # | Decision | Rests on |
|---|---|---|
| MK-20 | **A margin note lies in one chapter.** A verse, a passage inside one chapter, or one chapter. A passage across a chapter break (Numbers 25:10-26:2) is refused with a plain sentence; the file is `margin/<BOOK>/<chapter>.md`, so a note across two would sit in two files. | MK-17 (one file per chapter); MK-7 |
| MK-21 | **Delete is recoverable.** `wb margin rm` copies the note to `.trash/<time>-<id>.md` first; `wb margin restore <id>` puts it back. That file is not a page, so Trash's seven-day erase never touches it. | AGENTS.md ("anything deleted is moved to .trash") |
| MK-22 | **The pencil is kept in `pencil/<BOOK>.json`**, one small file per book, each line `{id, anchor, created}`. It does not touch the highlight files. U again (`wb hl pencil --clear`) takes off every line that touches the place. | MK-1, MK-19; [highlights](../highlights/README.md) leaves its own format open |
| MK-23 | **A page carries no `anchor` at all.** New pages in the Inbox, notes on a thread and the like no longer write `anchor: ""` in their front matter. Pages that already have one are read as before and not rewritten. | "A new page has no `anchor` in its front matter" (the build list); the no-places decision |
| MK-24 | **A margin note's id carries the millisecond** (`m_<second><ms>_<hex>`), so notes written in one second still sort in the order written. | MK-17, MK-19 |
| MK-25 | **The verse index lives in memory**, one entry per page, forgotten when that page's file is read again or is gone and worked out again on the next question. It is not written to disk; a `wb` run builds it when it first needs it, the window keeps it. | MK-14 |
| MK-26 | **A saved phrase's line is the thread underline already drawn.** The folder's own colour belongs to threads (`wb folder color`, not built); until it is, nothing new is drawn for a saved phrase. | MK-1 (M15); [threads](../threads/README.md) |
| MK-27 | **"Remember my choice" is the setting `margin` → `write_choice`** (`margin` or `page`), read and set by `wb settings margin`. | MK-3 (M27) |
| MK-28 | **Scripture in this page folds past 30 scriptures** to books with counts; open it is at most 6 rows (30 px each). | MK-5 (M22, M39) |
| MK-29 | **The margin opens again where it was left.** Going Back to a chapter whose verse was open in the margin opens it on that verse again; closing it with × forgets it. | "the margin still open on verse 11" (the build list) |
| MK-30 | **The Margin notes row sits in the Notebook's own side list** (and its narrow list) until the Library's side list (library S25 to S35) is built; it is one component and moves there as it is. | MK-12; [library](../library/README.md) |

## Needs the person

Nothing. All three were answered by the person on 2026-11-17 (accepted the recommendation):

1. ~~How margin notes are kept on disk.~~ One Markdown file per chapter: MK-17.
2. ~~Moving the old notes that have a place, once.~~ The rule and the steps: MK-18 (the move is not run by the decision).
3. ~~History (M18, M19).~~ Dates kept, no earlier versions of pages yet: MK-19.

## The real conditions

| Condition | Window |
|---|---|
| Among other tabs | M42 (the verse's margin as one tab of four beside the reader with its margin marks) |
| Floating | M43 (the verse's margin as a 320 px floating pane beside the verse) |
| Narrow | M44 (a 390 px phone: folded marks, the margin as a sheet, writing asks where); M12 (a reader a third of the window); M23 (the overview as one line) |
| Years of study | M36 (the busiest chapter), M37 (one verse: 41 margin notes, 312 pages), M38 (the map), M39 (86 scriptures in one page), M40 (searching everything) |

## What the build must satisfy

Ready to build (the person answered "Needs the person" 1-3 on 2026-11-17: MK-17 to MK-19). Each line is checked in a
Rust test or the desk check on a generated scratch study, never the real folder.

- [x] **No place.** A new page has no `anchor` in its front matter; a page that names Numbers 25:11 in a paragraph, a scripture block or a word block is listed for that verse by `wb anchor "Num 25:11"`, and removing the reference removes it from the list with no other file changed. *Evidence: `wb-cli/tests/marks.rs` `no_place_a_page_is_tethered_by_its_own_text`.*
- [x] **Scripture in this page.** A page naming 5 scriptures shows them in Bible order under "Scripture in this page · 5", each saying where it is named; a click scrolls to that block, its arrow opens the text. At 560 px or wider it is open and at most 6 rows high; narrower it is one line that opens the list (M22, M23). It equals `wb refs` run on the page's text plus its scripture and word blocks. *Evidence: Rust `scripture_in_this_page_is_the_refs_of_its_text_and_blocks` (5 in Bible order, where named, equals `wb refs`, 80 fold to books); `ui/tests/marks-notebook.spec.ts` (open and at most 6 rows wide, one line narrow, folds to books with counts).*
- [x] **The reader's margin.** For Numbers 25 with 2 margin notes and 3 pages on verse 11, the margin beside verse 11 shows a mark and "2 notes · 3 pages"; hovering shows their first lines; a click opens the verse in the margin (M26, M25). The reading column's width and line breaks are the same with the margin on and off. *Evidence: `ui/tests/marks.spec.ts` (mark, hover, click, same column on and off).*
- [x] **The verse opened in the margin.** It shows the verse (from the database, verbatim), its margin notes, then one line of counts: pages that name it, saves, marks, notes on the passage around it; each count opens its list in place (M25). *Evidence: `marks.rs` `the_readers_margin_counts_notes_and_pages_and_the_verse_opens_verbatim`; `marks.spec.ts`.*
- [x] **Writing asks where.** Typing in the margin's field and pressing Enter shows Leave in the margin and Add to a new page; the first writes a margin note at that verse; the second makes a page whose first line is the reference and opens it; "Remember my choice" stops the question until changed in Settings (M27). *Evidence: `marks.spec.ts` "writing asks where"; `marks.rs` `writing_asks_where_a_page_first_line_is_the_reference`.*
- [x] **Passages and chapters.** A note on Numbers 25:10-13 shows a bracket beside verses 10 to 13 and is listed, smaller, in the margin of each of them; a chapter's note sits at the chapter's top (M28). *Evidence: `marks.rs` `passages_and_chapters_are_listed_smaller...`; `marks.spec.ts` bracket and chapter top.*
- [x] **A margin note's menu.** Grow into a page, Add to a page…, Make it a question, Delete, and nothing else; no line appears under a long note; the margin never shows a prompt (M32). *Evidence: `marks.spec.ts` "four choices in its menu and nothing else".*
- [x] **Grow, not move.** Grow into a page makes a page whose first block is a jot fence holding the note's id; the note is still in the margin with "grew into <page>"; editing the note in either place changes the one note; deleting the page leaves the note and removes the line (M33, M34). Add to a page… lists pages that already name the verse first, then the last written in, then a search (M35). *Evidence: `marks.rs` `grow_not_move`.*
- [ ] **Margin notes in the Library.** The side list's Margin notes row opens books, then chapters, each with its count; a chapter lists each note under its verse's first words; a click opens the reader at that verse with its margin open. A margin note cannot be dragged into a folder or pinned (M30, M31). *Built so far: `wb margin list` and its test; the folded row in the Notebook side list (`ui/src/kinds.ts`); no WebKit test of the row yet. The Library side list of the library design is not built, so the row sits at the foot of the Notebook's own side list.*
- [x] **One line under a run.** A pencil line (U on a selection; U again removes it) and a saved phrase's line are each one line under the whole run, broken only where the text line breaks; no dotted line is drawn anywhere (M13, M14, M15). *Evidence: `marks.spec.ts` "the pencil is one line under a run"; no dotted rule remains in `style.css`.*
- [x] **A passage with your marks.** A scripture block switched to With my marks shows the same colors and pencil as the reader and one dot per verse that has a note, page or save; a click on a dot opens a card in the page without scrolling it; switched back, the file's fence holds the reference and the switch only (M6, M7). *Evidence: Rust `the_pencil_is_one_line_with_a_date_and_never_a_highlight`; `marks-notebook.spec.ts` "a passage with my marks" (switch, one dot per verse, card in place without scrolling the page).*
- [x] **Filters.** The search field's menu lists the kinds (Pages, Saves, Questions, Margin notes, Highlights) with counts; choosing one narrows the results and shows as one line of text; there are no chips and no side list of kinds (M21). *Evidence: Rust `filters_list_the_kinds_with_counts`; `marks-notebook.spec.ts` "the search’s kinds are one menu" (counts, one line of text, no chips, no side list).*
- [x] **Among other tabs, floating, narrow.** As one tab of four the verse's margin shows the verse and the counts line without a horizontal scroll bar at 500 px; floated at 320 px the counts wrap whole and the pane does not cover the verse it is about when opened; at 390 px the marks fold to one mark at the verse number, and the margin is a sheet reaching the bottom edge holding the field and the two choices (M42, M43, M44, M12). *Evidence: `marks.spec.ts`: 390 px one mark and a sheet, 500 px tab with no sideways scroll, 320 px floating counts wrap whole and the pane does not cover the verse.*
- [ ] **Years of study. (desk)** On a generated study of 2,400 pages, 3,100 margin notes and 18,000 highlights: John 3 opens inside the reader's budget in `npm run measure` with one line of counts per verse (M36); John 3:16's margin shows its notes newest first folded by year and its 312 pages grouped by folder in the order of MK-13, never more than 20 rows before "Show all" (M37); the map shades every chapter by its count (M38); a page with 86 scriptures folds the overview to books with counts (M39); a search answers inside the search budget, grouped by kind (M40). *Built so far: `wb-core/tests/marks_years.rs` builds 2,400 pages, 3,100 margin notes and 18,000 highlights and checks John 3:16 (41 notes newest first, its pages in MK-13 order, 20 rows then Show all, grouped by folder), the map and the search; `npm run measure` budgets are not run.*
- [x] **The cache.** After one page is saved, only that page's entries in the verse index change (a test counts the files read: 1); opening a chapter reads no page file (MK-14). *Evidence: `wb-core/tests/marks_index.rs`.*
- [ ] **The reader's place is kept. (desk)** From Numbers 25:11, opening the verse in the margin, opening a page from its list, following that page's reference to Psalms 106:30 and going back twice returns the reader to Numbers 25:11 at the same scroll position with the margin still open on verse 11. From Margin notes in the Library, a click on a note and Back returns to the same row. *Built so far: nothing to tick before the desk check: the verse opens in the margin without moving the reader; the Back path is the existing one.*
- [x] **Old forms are read.** With 5 notes that still have an `anchor`, each shows in its verse's margin and opens as today; no file is rewritten by reading (compare hashes). *Evidence: `marks.rs` `old_placed_notes_are_read_and_nothing_is_rewritten`.*
- [x] **Commands.** Existing: `wb marks`, `wb anchor`, `wb refs`, `wb page scripture`, `wb block scripture`, `wb page blocks`, `wb find`, `wb hl …`. Required and missing today: `wb margin "Num 25"` (a chapter's or verse's margin notes), `wb margin add "Num 25:11" "text" [--question]`, `wb margin edit <id> "text"`, `wb margin rm <id>`, `wb margin grow <id> [--into <page id>]`, `wb margin list [--book NUM]` (the Library's counts), `wb page overview <id>` (Scripture in this page), `wb block scripture <id> <n> --marks | --no-marks`, `wb hl pencil "<place>"` and `wb hl pencil --clear "<place>"`, `wb anchor <place> --pages` (the ordered pages; also named by [words](../words/README.md)), and `wb study check --margin-move` (the read-only list of MK-18). *Evidence: `marks.rs` and `every_action.rs`; every command named is in `wb help`.*
- [x] **The margin's file.** A margin note written at Numbers 25:11 on a scratch study is written to `margin/NUM/25.md` under a line naming Numbers 25:11 with the note's id and the date it was written; a note on Numbers 25:10-13 is under a line naming the passage, and a note on the chapter under a line naming Numbers 25; a question note is the `> [!question]` callout line; Grow into a page writes a jot fence holding only the id; editing one note changes only that chapter's file (MK-17). *Evidence: `marks.rs` `the_margins_file_dates_and_questions`.*
- [x] **Dates, no versions.** Every margin note carries the date it was written, and no earlier version of a page is written anywhere in the study folder (MK-19). *Evidence: same test: a `written=` date on each note, a `created` date on each highlight and pencil line, no version file.*
- [x] **The study files.** The margin's files, the jot fence and the dates are written only in MK-17's form. No file the person already has is moved or rewritten by this build: the move of old placed notes (MK-18) happens once, designed, the read-only list first, tried on a scratch copy after a hashed backup (`scripts/backup-study.ps1`), and run on the real folder only with the person's go-ahead. *Evidence: `marks.rs` snapshots: reading and `--margin-move` rewrite no file; the move (MK-18) is not built.*

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 240e (2026-11-10) | The person's own cross-references, not from another source |
| b91a (2026-11-11) | Intuitive for anyone: the old preacher, the new reader, the busy mother, the missionary |
| 5a80 (2026-11-11) | Notes as a layer on the text, like writing in an analog Bible, not pop-ups |
| ed73 (2026-11-11) | A page anchored to scripture could show those verses in a small, clean way |
| 95db (2026-11-12) | Find phrases quoted from scripture in a page and offer the card or a quiet tag; spell check that stays after leaving a block |

## The record (2026-11-12)

Everything from here down is the record of how the decisions above were reached. Where it differs from the Leading
design and MK-1 to MK-19, those win: a page now has no place (it is tethered by its text), the
Library has five pieces (library L-11), M24 and the dotted line are dropped, and the margin never prompts.

## What is already decided elsewhere (the frame this must fit, as it stood on 2026-11-12)

- **Everything you write is a page** (R1, 2026-11-09). A note at a verse is a page whose place is that verse; the
  files do not move.
- **Questions are only lines in pages**, with one list of them as a view (questions, 2026-11-12).
- **What you wrote sits in a margin beside its verse, names only, each a link** (reader C, 2026-11-11).
- **Saves show in the left margin** (library S8, S16 liked); how pages are listed on the right is not liked yet (S16).
- **The Library is four pieces** (library S20): Page (you write it), Folder (you sort into it), Save (a pointer),
  Library (one tree, one search).
- **One panel shows or hides every kind of mark** (reader R7).

## The concept proposed (2026-11-12, for the person's review)

### 1. A mark is how the text shows something of yours. It is not a new thing you make.

Two layers, and nothing else draws on the text:

| Layer | Kinds | Has words of yours? | Where it is kept |
|---|---|---|---|
| **On the words** | a highlight (a color, maybe a named one or a layer: [highlights](../highlights/README.md)), a thread's underline | no | `highlights/`, `threads/` (as now) |
| **In the margin** | a save (left margin), and beside the verse: a page at that place, a question line, a page that mentions the verse | yes, or a name | the page or the save that holds it (as now) |

So the margin is **a view, not a store**. A question in the margin *is* the question line in a page, shown again where
its verse is; a page "on" a verse is listed there by its title. Taking the margin away loses nothing.

### 2. Marks do not replace notes; the note became "the verse's page".

What used to be a note at a verse is the page whose place is that verse (it already is, in the files). Writing in the
margin writes into that page: a question becomes a question line at its end, a quick thought a paragraph. The page is
made the first time, named by its place ("Numbers 25:11"). So there is one kind of writing (a page) and many ways in:
from the reader's margin, from the Notebook, from a verse's right-click.

Anything that can be opened can carry a mark only if it has a **place**: a verse, a run of words, a chapter, a book, or
a Strong's number (a page at H7065 is already possible). Marks on a lexicon entry (books K5) are highlights at a
Strong's number, the same model. Nothing else (a search, a document) gets marks; those are saved, not marked.

### 3. A page can bring in a passage with its marks.

The scripture block (`wb page scripture`) already shows a passage with its highlights. It gains a switch:
**Just the text · With my marks**. With marks, the block draws the passage as the reader does, with its margin: the
questions, saves and pages on those verses, each a link. This is how a page "references a passage and its markings"
without copying them: they stay where they live and are shown again. A **chapter** in a scripture block is the same.

### 4. The questions list is a list of marks of one kind; in the Library it is a search, not a place.

The Library's tree holds things you sort (pages, folders, saves). Questions are lines inside pages, not things you
sort, so a Questions *section* in the tree (questions Q7) breaks library S20's line. Instead:

- **In the Library**: its one search (library S21) has kind filters, the same as the marks panel's kinds: Pages, Saves,
  Questions, Highlights. "Questions · open" is one click there. Nothing new in the tree.
- **In a page**: a saved list block (questions Q6, settings S5) with the same line (`notebook questions open @Num 25`).
  A page called Questions holding only that block is the old tab, if the person wants one.
- **At the reader**: the marks panel (reader R7) shows the chapter's marks by kind with a count each; a click on
  Questions lists this chapter's.

So one list engine, three doors: the Library's search, a block in a page, the reader's marks panel. All three are the
same `wb` line.

## The person's answers to the concept (2026-11-12)

- **1. Is the margin its own store?** That is the real question. A margin note in a printed Bible is apart from the
  notebook, but this app's point is that notes are accessible, connected, expandable and freely editable (reader R6,
  library S16).
- **2. Every verse could have its own page:** its main notes, and below them a references section listing every
  reference to the verse or to a word in it, so any page placed at a verse is a reference on that verse's page. It may
  need more storage and could expand things more than needed, but it is exactly how people keep margin notes over the
  years (a second Bible, a journal). Interconnection and organization, with reading and learning first, and
  user-friendly.
- **3. A passage in a page, with or without marks: wanted.** Like a photograph of an annotated Bible. Keep it clean;
  how to show everything without clutter needs working through.
- **4. Questions: a search filter at most.** (Questions Q7, a Library section, is dropped.)
- **5. A thread is a folder of saves** (leaning). Then what does an underline mean? Give a system people can understand
  that does not fight their own way of organizing.

## Decisions (the person, 2026-11-12)

- **Questions are a filter of the Library's search**, not a Library section (answer 4).
- **A passage can be shown in a page with your marks** (answer 3); how it stays uncluttered is round 1's M6-M7.

## Round 1 (2026-11-12): the model drawn

- **M1, the model.** On the words: a highlight (meaning), a pencil underline (attention), the dotted underline
  (something written on these words). Left margin: saves. Right margin: the verse's page. Under it all, the verse's
  page; any other page; the Library.
- **The verse's page answers 1 and 2 together.** The margin note *is* the verse's page: its notes, edited right in the
  margin (M2, M3), opened whole with ⤢ (M4). So the margin is not a separate store, yet it reads like a margin.
- **References need no new storage (M4).** They are found when the page opens, from the files and the cache that
  already index places (`wb anchor` lists everything on a place today). Nothing is copied into the verse's page, so a
  new page placed at the verse just appears there, and deleting it takes it away.
- **Only the notes are kept.** The verse's page is an ordinary page file at that place (a note with an anchor, as the
  Python app already has), titled by the place and made the first time you write.
- **M5, the underline, three meanings:** U-A a pencil line (emphasis with no meaning, one key); U-B the way a saved
  phrase shows (a thread's verses are underlined because they are saved in it); U-C your own named styles (underline,
  box, circle, wavy).
- **M6, M7, a passage in a page:** Just the text · With my marks. With marks: colors and pencil on the words, one dot
  per verse with a page and a count; a click opens a small card, and the page you write in never moves. "As of a
  date…" is offered for the photograph idea.
- **M8, questions as the search's filter**, with Keep as a list in a page.

## Decision: no places, only tethers (the person, 2026-11-12)

- **A page has no place.** The place feature (a page anchored to a verse, `anchor` in its front matter) is removed.
- **A reference written in a page tethers it** to that verse, passage, chapter or word: wherever the page names it
  (a reference in a paragraph, a scripture block, a word block). A tether is not an anchor: a page can have many, none
  is its home, and the page is never weighed down by them. They make it traversable: from the text to the pages that
  name it, and from a page to the text it names. The app already finds references in text (`wb refs`).
- **Fewer, less redundant references:** a page names a verse once, in its own words, instead of a place field and a
  mention that say the same thing twice.
- **The Python app is no longer the measure.** The person accepts that this breaks the Python app's reading of new
  pages: the aim is to make the Rust app far better, not to stay tied to the Python one. (This changes the standing
  rule "Same files, same formats" in AGENTS.md; see below.)

### What follows from it (proposed, for the person's review)

- **(Superseded the same day: the margin is the verse's page.)** With no places, nothing makes one page "the verse's". A verse shows the pages tethered to
  it (round 2's M11 becomes the design: the verse and what names it, with New page here). Open questions 1-3 of round
  2 fall away.
- **Writing in the margin** makes a new page whose first line is the reference ("Numbers 25:11"), so it is tethered by
  its own text; the margin then lists it like any other. Or it adds a paragraph to the last page you wrote on that
  verse. (To choose.)
- **The right margin** lists the pages that name a verse: names first (reader R6, liked), their lines on hover or
  click (M2).
- **Questions** are question lines in pages (decided); a question is tethered by the references in its own line or,
  with none, by its page's. Questions B's "the verse's page" becomes "a page naming the verse".
- **A word's page:** a page tethered to "zealous" in Numbers 25:11 names the run (a word block, or a reference to the
  word); a page about H7065 names the number. Both are found from either side.
- **Old notes with a place** are moved once (with the person's go-ahead, on a scratch copy first): the place becomes a
  reference line at the top of the page, so nothing is lost and every old note stays tethered where it was.
- **Saves are not pages** and keep pointing at what they save (library S20); a save is a pointer, not a tether.
- **What still needs a design:** how a tether shows in the page itself (the reference as a link, a quiet mark), how a
  page that names a whole chapter or book shows in the reader's margin without clutter, and whether a tether can be
  turned off for a reference that is only in passing.

## Decisions: a page's scripture overview, and the margin as the verse's store (the person, 2026-11-12, later)

These refine "no places, only tethers" above.

- **A page keeps a record of the scripture it names.** Instead of a place, the page tracks every reference in it (a
  reference in a paragraph, a scripture block, a word block), found from its text. At the top of the page it is shown
  as a scrollable overview, *Scripture in this page* (name to be settled: Scripture, Scripture references,
  References): every verse, passage and chapter the page names, in Bible order, each a link to where it is in the page
  and to the text. A long page, lesson or study can be seen at a glance by its scriptures. This record is also what
  tethers the page to the text.
- **The margin is the verse's page** (the word "margin" is used for it). It is the store of every note on a verse, a
  passage or a chapter, and it also shows that place's saves, the pages that reference it (cross-references), and its
  marks. To see everything for a verse you *open the verse in the margin*.
- **Writing in the margin asks:** add this to a new page, or just leave it in the margin. Leaving it is a margin note,
  kept with the verse; a new page is an ordinary page whose text names the verse (so it is tethered and listed there).
- **The Python app is not a constraint** (AGENTS.md rewritten the same day): the margin's notes and the page's record
  may take whatever form serves this app best.

### What follows (proposed)

- The verse's page of round 2 comes back as **the margin**, now without a place field: it is keyed by the verse,
  passage or chapter itself. Round 2's M9 (a line of counts) and M10 (names beside) are its two drawn forms; the
  person's earlier liking for reader R6's names as the first view still holds.
- A margin note on a **passage or chapter** sits in that passage's or chapter's margin; the verse's margin lists those
  that cover it, smaller.
- Open: how margin notes are kept on disk (one file per book or chapter, or one per place); whether a margin note can
  later be *moved* into a page (and back); what the page's scripture overview looks like in a narrow pane; whether a
  reference made only in passing can be left out of the overview.

## Review of round 1 (the person, 2026-11-12)

- **M4:** draw a few designs of a verse's page; the references are too big, above all in a narrow pane. The same for
  every mark when many tabs are open (M9-M12).
- **M5:** an underline should join the words of a run, not sit under each word with gaps (M13). Expand the pencil, the
  saved phrase and your own styles to see them at work before choosing; they are not necessarily at odds (M14-M16).
- **M6, M7:** the pencil clashes with the dotted line; revisit what the dotted line does and whether anything else
  already says it (M17). The photograph is liked; a dot may not look clickable, but it is liked.
- **M8:** chips as filters are not liked (M20, M21).
- **Q3:** reader R6 (names only) as the first view, perhaps mixed with M2; M2 not fully liked.
- **Q5:** not a phrase on a button; a cleaner way to show history, to see your thoughts develop (M18, M19).

## Round 2 (2026-11-12)

- **M9, verse page A:** your notes, then the references as one quiet line of counts (3 pages · 1 word · 1 question ·
  saved in 2); a count opens its list in place. Built for a 420-wide pane.
- **M10, verse page B:** the references as small names in a right margin of the page itself, beside what they relate
  to; it folds into A's line when narrow.
- **M11, verse page C:** no writing on the verse: the verse and the list of what refers to it, with New page here.
- **M12, many tabs:** a reader a third of the window folds both margins into small marks at the verse number (a
  ribbon, a page corner); hover names them; a click opens the verse's page in that pane.
- **M13:** one line under a run, broken only where the line of text breaks; today's per-word lines beside it.
- **M14, the pencil:** grey and thin; U, or Pencil under the colors in the right-click menu; U again takes it off.
- **M15, a saved phrase:** its folder's color under the run; two folders, two close lines; hover names them; a whole
  verse saved keeps the ribbon in the margin, so lines are for phrases.
- **M16, your own styles:** box, circle, double line, pencil, each named by you (a sample: Promise, Name, Command),
  each with an eye.
- **M17, the dotted line:** D1 drop it (the margin already says a page is on the verse), D2 a small mark after the run
  like a footnote mark, D3 nothing until you hover the margin's item.
- **M18, history on the verse's page:** a thin timeline at its foot, a dot for each time something of yours came to
  the verse; dragging back shows the notes as they were.
- **M19, the photograph with a date:** the same thin line under a passage block in a page; set once, the block keeps
  that date.
- **M20, M21, filters:** a list of kinds down the side with counts (A), or one menu at the start of the search field,
  "Everything ▾" (B).

## Pros and cons asked for (2026-11-12): closed

Tables 1 and 6 were closed the same day by the person's decisions (no place field; the margin is the verse's page, written only when you write). Table 2 is closed by MK-9. Kept as the record.

### 1. Which page is "the verse's page" when several pages are placed at one verse?

| Way | For | Against |
|---|---|---|
| **a. The page titled by the place** (made from the margin, "Numbers 25:11") | No new field; the Python app sees an ordinary page; easy to explain | A page titled "Numbers 25:11" by hand becomes it by accident; renaming it silently stops it being the verse's page |
| **b. A field marks it** (`verse: NUM.25:11`, one the Python app passes over) | Exact; survives renaming; the title can be anything | A new field; two pages could claim the same verse and need a rule |
| **c. None is special** (M11: every page at the verse is equal) | Nothing new at all; no "which one" question | No single margin note; the margin is a list, not your note |

**Better, proposed:** b, with a's title as its default. The field is set only by writing in the margin (or Make this
the verse's page), so never by accident; a second claim is refused with "Numbers 25:11 already has a page: open it".
The title starts as the place and can be changed.

### 2. A word's page: "zealous in Numbers 25:11", or H7065 everywhere?

| Way | For | Against |
|---|---|---|
| **a. A page on the run of words in this verse** (an anchor on the words, as notes on words are today) | Exactly what you were looking at; sits beside the word in the margin | The same Hebrew word in 40 other verses knows nothing of it |
| **b. A page on the Strong's number** (H7065, everywhere) | One study of the word gathers everything; every verse with the word can show it | A thought about this verse's use is buried among the word's other uses; English words with no number have nowhere to go |
| **c. Both, linked** | Each in its place | Two pages to choose between when writing |

**Better, proposed:** write where you are (a, the run), and let the word's page (b) list every run-page with that
number as a reference, the way a verse's page lists pages placed at it. One rule throughout: a page is kept where it
was written and listed wherever it refers. Writing a page on H7065 itself stays possible from the Concordance.

### 6. Is a writable verse page too much, or only a list of where the verse is referenced?

| Way | For | Against |
|---|---|---|
| **Writable** (M9, M10) | It is the margin note people keep in a second Bible over the years; one place for "my thoughts on this verse" | A page per verse could mean thousands of near-empty pages; a second place to write besides your pages |
| **A list only** (M11) | Nothing new to keep; every thought lives in a real page you named | No margin note; a quick thought needs a page with a title first |

**Better, proposed:** writable, but made only when you write. A verse never written on has no page, only its list
(M11 is what an unwritten verse shows). So the number of verse pages is the number of verses you actually wrote in a
margin, as in a paper Bible.

## Open questions (round 2): all closed 2026-11-16

Closed by the decisions at the top: 4 by MK-1, 5 by MK-2, 6 by MK-19 (the person, 2026-11-17), 7 by MK-4, 8 by MK-3. Kept as asked:

1-3. Settled 2026-11-12: no place field; references in a page tether it; the margin is the verse's page and the
   store of its notes (see the decisions above).
4. The underline: pencil (M14), saved phrase (M15), your own styles (M16), or more than one? M13's joined line for all.
5. The dotted line: D1, D2 or D3?
6. History (M18, M19) needs what this app does not keep today: when each mark was made and how a page read before.
   Worth keeping (a page's earlier versions in the study folder, a date on each highlight)?
7. Filters: the side list (M20) or the field's menu (M21)?
8. The reader's margin: R6's names as the first view, opening to M2's lines on hover or click? (Drawn in M26.)

## Round 3 (2026-11-12)

- **M22, a page's scripture overview:** at the top, *Scripture in this page · 5*: every scripture the page names, in
  Bible order, each with where it is named (a scripture block, ¶2); a click goes to that spot, its arrow to the text.
  Found from the page's text; it is the page's tether.
- **M23, narrow:** the overview folds to one wrapping line of references; a click opens the full list; a book button in
  the pane's head brings it back after scrolling.
- **M24, a reference in passing:** right-click a reference in the text, Not a tether: it stays a link, is listed greyed
  at the overview's foot, and the verse's margin does not list the page.
- **M25, the verse opened in the margin:** beside the reader: the verse, its margin notes, then one line of counts
  (pages that name it, saves, marks, notes on the passage around it), each opening its list.
- **M26, the reader's margin:** R6's names first (a mark and "2 notes · 3 pages"), M2's lines and counts on hover, M25
  on click.
- **M27, writing asks where:** Leave in the margin, or Add to a new page (whose first line names the verse); Remember
  my choice.
- **M28, a passage and a chapter:** notes on 25:10–13 sit in that passage's margin with a bracket beside the verses;
  the chapter's notes sit at its top; a verse's margin lists them, smaller.
- **M29, moving a note:** a margin note's ⋯: Move to a new page, Move to a page…, Ask as a question, Delete. A page's
  paragraph that names one place has Move to the margin. A note is in one place at a time.

## The margin and the Notebook: a jot and a page (proposed, 2026-11-12)

The person: the margin should have its own place in the Library. How is it kept from becoming a second Notebook? The
way a preacher jots a thought in the Bible, then goes to the notebook and expands it, perhaps starting from that jot.
So making a page out of a thought, or attaching it to an existing page, matters.

**The distinction: the margin holds jots; the Notebook holds pages.**

| | A jot (the margin) | A page (the Notebook) |
|---|---|---|
| What it is | A thought caught while reading | A thought worked out |
| Where it lives | At one verse, passage or chapter; nowhere else | In the Notebook's tree; tethered to every scripture it names |
| Its shape | Plain sentences, references and a question mark; no title, headings, blocks, tables or pages inside | Anything a page can hold |
| How it is ordered | The Bible's order only; no folders, no pinning, no nesting | Nested, pinned, sorted into folders |
| In the Library | **Margin notes**: book › chapter › verse, with counts | **Pages** |

**The way between them: a jot grows into a page; it is not moved.**

- **Grow into a page** (a jot's ⋯, or when a jot passes a few lines the margin offers it): a new page starts with the
  jot as its first block, shown as the seed, quoted and linked, with the verse named so the page is tethered. The jot
  stays in the margin, where it was written, with a small line under it: *grew into Phinehas*. As in a paper Bible: the
  jot is still in the margin after the notebook took it further.
- **Add to a page** (⋯ › Add to a page…): the same, into a page that already exists, at its end or where you choose.
  The margin's line then names that page.
- **Nothing is copied.** The page's seed block shows the jot as it is now (a jot block holds only the jot's id, as a
  thread or word block does); editing the jot in either place edits the one jot. Deleting the page leaves the jot.
- **The other way stays small.** A page's paragraph is not moved into the margin; a page is already listed in the
  margins of every scripture it names. (M29's Move to the margin is dropped; its Move to a page becomes Grow into a
  page.)
- **Questions:** a jot can be a question (a jot that is a question line). Grown into a page, it becomes a question
  line there, still one question.

**What keeps the margin from growing into a Notebook:** a jot has no structure to grow, it has one place and no title,
and the Bible is its only order. When a jot wants more (length, headings, a second scripture worked through), the
margin offers to grow it into a page instead of growing itself.

## Round 4 (2026-11-12)

- **M30, Margin notes in the Library:** a section of its own beside Pages (Pinned, Pages, Margin notes, Folders, Shelf),
  in the Bible's order: books open to chapters, each with how many jots it holds. Never sorted into folders; reached by
  the Library's search like everything else.
- **M31, a chapter's jots:** Numbers 25 opened, each jot under its verse's first words; a jot that grew shows *grew into
  Phinehas*; a question jot shows its mark. A click opens the reader at the verse with its margin open.
- **M32, a jot's menu and the offer:** Grow into a page, Add to a page…, Make it a question, Delete. A jot that runs
  long gets a quiet line under it: *Getting long: grow it into a page?*
- **M33, the page a jot grew into:** the jot as its seed block (*From the margin at Numbers 25:11*), the overview
  listing Numbers 25:11 as the seed, your writing beneath.
- **M34, the margin after:** the jot where it was, with *grew into Phinehas*; the page counted once among the pages
  that name the verse.
- **M35, Add to a page…:** pages that already name the verse first, then the last pages written in, then a search.

## Round 5 (2026-11-12): a full vault, fifteen years on

A projection, not the person's data: on 2026-11-12 the study folder held about 121 pages and 9 threads. Drawn at
about 2,400 pages, 3,100 jots, 18,000 highlights and 140 folders (weekly lessons and daily reading for fifteen years).

- **M36, the busiest chapter:** John 3 with every verse marked. The margin shows one line of counts per verse
  (3:16: 41 jots · 312 pages · 9 saved), the same size however much is behind it.
- **M37, one verse's margin:** John 3:16's 41 jots, newest first, folded by year; its 312 pages grouped by folder with
  counts and a search, never listed by the hundred.
- **M38, Margin notes as a map:** every book a bar of its chapters, shaded by how many jots each holds; where you have
  never written shows as plainly as where you have.
- **M39, a long lesson's overview:** 86 scriptures folded to 14 books with counts, a book opening to its references.
- **M40, searching everything:** results grouped by kind with counts, best first, each showing where it lives; a
  place typed jumps to its margin.
- **M41, the Pages tree:** Pinned and Recent first, folders one level at a time with counts, a long folder showing its
  newest twenty and Show all.

### Does it hold up? Where the model holds, and where it strains

**Holds:**
- **The text stays readable.** Nothing you add grows the reader: the margin is a line of counts per verse whatever
  sits behind it (M36), and everything else is a click away. Reading stays first at any size.
- **Every view has a natural order that scales:** the Bible's order for the margin and Margin notes, time for a
  verse's jots (M37), folders and recency for pages (M41). None of them needs the person to tidy anything.
- **The years become an asset, not clutter:** a verse's jots by year show how a thought grew; the map (M38) shows a
  life of study at a glance; *grew into* links follow a thought from Bible to sermon. This is what a paper Bible and a
  shelf of notebooks cannot do.
- **Nothing is copied**, so nothing goes stale: references and the overview are found from the pages themselves.

**Strains, and what each needs:**
1. **Highlights become wallpaper.** In M36 nearly every verse is colored, and a color that is everywhere says nothing.
   Designed in [highlights](../highlights/README.md) round 2 (H8-H14, 2026-11-12).
   It needs the layers by year from [highlights](../highlights/README.md) B (show this year's only) and named colors,
   and the marks panel's eyes. Without them, highlights stop adding value after a few years.
2. **Hundreds of pages naming one verse.** 312 pages on John 3:16 is a list nobody reads. Grouping by folder (M37)
   helps; it needs the pages' own words to rank them (a page *about* the verse before a page that names it once in
   passing). "Not a tether" (M24) is the person's tool for this; an automatic weight (how often a page names the verse,
   whether in a scripture block) would be the app's.
3. **Search is carrying the weight.** At 2,400 pages the tree is for walking, the search for finding (M40, M41). The
   search must be fast and good (whole words, places, best first) or the Library fails. It needs a full-text index in
   the cache, built in the background, and a speed budget in `npm run measure`.
4. **Speed.** Counting tethers for a chapter with 300 pages per verse must not be done by reading files when the
   chapter opens. The cache must index references (verse → pages, verse → jots) and update one page at a time on
   save. This is a build requirement, not a design choice; it belongs in "what the build must satisfy".
5. **Folders drift.** After fifteen years, folders made in year one stop fitting. Moving many pages at once, merging
   folders, and seeing pages in no folder need a design ([library](../library/README.md)).
6. **The top bar's place button** in these sheets still says Numbers 25 (a sheet shortcut, not a design point).

**Verdict (proposed):** the model holds for a seasoned teacher *if* three things are built with it, not after it:
highlights by layer, ranking of the pages that name a verse, and a cache that indexes references and full text. The
rest scales by its own order.

## Open questions (round 3): all closed 2026-11-16

Closed by the decisions at the top: 1 and 2 by MK-5, 3 by MK-6, 4 by MK-17 (the person, 2026-11-17), 5 by MK-7, 6 by MK-8, 7 by MK-10. Kept as asked:

1. The overview's name: Scripture in this page, Scripture, References?
2. Should the overview be shown always, or folded by default (M23's line) in every width?
3. Not a tether (M24): wanted, or does every reference count?
4. How margin notes are kept on disk: one file per chapter (all its verses' and passages' notes), or one per place?
5. Margin notes on a passage (M28): a bracket beside the verses, or listed under the first verse only?
6. The jot and the page (above): accept "grow, not move", with the jot kept and a seed block in the page?
7. When does the margin offer to grow a jot: past a number of lines, on a heading or a second reference, or only from
   the ⋯?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 0 | 2026-11-12 | none | the concept in words | answered above (2026-11-12) |
| 1 | 2026-11-12 | M1-M8 | the model, the reader's two margins, the verse's page, the underline, a passage with marks, questions as a filter | reviewed above (2026-11-12) |
| 2 | 2026-11-12 | M9-M21 | three verse pages, many tabs, one line under a run, the three underlines at work, the dotted line, history, filters | Not reviewed by the person; decided by the overseer 2026-11-16 (MK-1, MK-2, MK-4) |
| 3 | 2026-11-12 | M22-M29 | a page's scripture overview (wide, narrow, a reference in passing); the margin opened, in the reader, writing asks where, passages and chapters, moving a note | Not reviewed by the person; decided by the overseer 2026-11-16 (MK-3, MK-5 to MK-7) |
| 4 | 2026-11-12 | M30-M35 | jots and pages: Margin notes in the Library, a chapter's jots, growing a jot into a page, the seed block, the margin after, adding to a page | Not reviewed by the person; decided by the overseer 2026-11-16 (MK-8, MK-10, MK-12) |
| 5 | 2026-11-12 | M36-M41 | a full vault fifteen years on: the busiest chapter, one verse's margin, the map, a long overview, searching everything, the Pages tree | Not reviewed by the person; M41 to library (MK-12); MK-13, MK-14 |
| 6 | 2026-11-16 | M42-M44; M32 redrawn; M16, M17, M20, M24, M41 off the board | the real conditions; the decisions of 2026-11-16 drawn | Accepted by the person, 2026-11-17 (with MK-17 to MK-19) |

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25-10-13.json` | `wb text "Num 25:10-13"` |
| `data/ps106-30-31.json` | `wb text "Ps 106:30-31"` (M22's scripture block; Romans 10:2 is shown only as a reference, so `rom10-2.json` was removed on 2026-11-16) |
| `data/john3-14-21.json` | `wb text "John 3:14-21"` (M36, M37) |

Scripture is fetched from the database, never typed. What the person wrote is a placeholder ("Your own words, as you
wrote them"); page names are a drawn sample.

## Touches

[reader](../reader/README.md) (the margin, the marks panel), [questions](../questions/README.md),
[library](../library/README.md) (S16, S20, S21), [highlights](../highlights/README.md), [threads](../threads/README.md),
[books](../books/README.md) K5, [settings](../settings/README.md) S5. See [overlaps.md](../overlaps.md).
