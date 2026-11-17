# The Concordance

**State:** accepted by the person 2026-11-16 (build starts on feature/concordance-build); was exploring (rounds 1-4 reviewed; the real conditions drawn 2026-11-16, C15-C20; round 4's decisions drawn, C21-C25) · **Sheets:** `python -I design/features/concordance/concordance.py` writes `concordance.figcraft`
and `concordance.pdf` (the board, one vector page; it imports words' `verse_card` and `verse_phone_sheet`) · Nothing here is built yet. What other tools get wrong, and so what this folder avoids:
[bible-software-complaints](../../research/bible-software-complaints.md).

**Readiness: likely finished** (2026-11-16, fifth pass, after the merge of the two concordance lines and the closing of round 4, by [ready-criteria](../ready-criteria.md); never "accepted", which is the person's word). The overseer closed the round 4 items (C-11 to C-13), drew them (C21-C25, `concordance.py:858-990`), seeded the app-wide [tab-history](../tab-history/README.md) folder, and re-read this README, `concordance.py`, [overlaps](../overlaps.md) and [coverage](../coverage.md); every new sheet was rendered to PNG and looked at, and the `wb` commands were run on 2026-11-16 with the release `wb` and an empty scratch study. All ten checks pass; three of the decisions below are inferences the person has not seen.

**Evidence**

- **1 Direction chosen: pass.** One direction leads (Leading design table, C-8); the three `c02-pick-*` options are marked superseded in that table, the person's a and c are drawn as C21-C23 (`concordance.py:874`, `:904`, `:921`). The letter strip and the box's numbers and sounds are drawn as C24 and C25 (`:933`, `:958`). Round 6 proposes no other direction, so no window waits on a review that changes one.
- **2 No open questions the decisions can answer: pass.** Open questions has only struck lines; round 4's two questions are C-11 and C-12 (README, Decisions table), each decided by overseer from the person's own round 4 words and the [complaints](../../research/bible-software-complaints.md). Nothing left is the person's by an `AGENTS.md` rule or a study-folder format.
- **3 The real conditions are drawn: pass.** Among other tabs C15 (`:757`), floated C16, narrow C17 and C18, years of study C19 and C20 (`:833`); every cell of "The real conditions" says drawn. C21-C25 are inside the same window and add nothing that needs its own narrow or long-study cell (C19 and C20 are the long-study cases).
- **4 What the build must satisfy: pass.** Every line names an input and a result; the picked word, the letter and the numbers and sounds each have a line with `wb` figures (zealous 8 places, zeal 16 and zealously 2; j 386 words, x none; H7068 43 places; H3657 for `kanna`); the return case is the "Return case, the reader's place is kept (5f45)" line.
- **5 Every action has a `wb` command: pass.** Run 2026-11-16: `strong H7068`, `uses zealous` (8), `count heart` (830 in 54 books), `forms zea` (zeal 16, zealous 8, zealously 2), `forms j` (386), `forms x` (none), `define H7068`, `define kanna` (H3657), `lexiconc zealous`, `interlinear "Num 25:11"`, `history list`, `shelf` answer. Missing and named as required in the Commands line: `wb concordance`, `wb strong --next/--list`, `wb uses --by`, `wb settings concordance`, `wb save`; the back button's command is named as required by [tab-history](../tab-history/README.md).
- **6 No overlap left unresolved: pass.** [overlaps](../overlaps.md) has Strong's index (b537) resolved (C-5), count, forms and near agrees (C-6), Save's mark agrees (C-7), the verse card and the word card resolved, and a new row, Going back inside a tab, agrees (the Concordance draws only the picked word's new tab; the button's design is [tab-history](../tab-history/README.md)'s). [coverage](../coverage.md) lists the Concordance once, with the box's picked word, letters, numbers and sounds, and lists tab-history as its own row with `history`; no other folder claims either. The [index](../README.md) lists both.
- **7 No contradiction with `AGENTS.md` or an accepted folder: pass.** The new back button has its own folder and coverage row before any build (the "Designed before it is built" rule); the click-on-a-word choice is [settings](../settings/README.md)'s accepted Reading line; the rail button is [minimize](../minimize/README.md)'s; the fetches open the database through `wb` with `WB_STUDY_DIR` set to an empty temp folder (`concordance.py:50-51`), never the person's folder. [panels](../panels/README.md)' "way back" is a different thing and tab-history says so.
- **8 Sheets match the README: pass.** The board was rendered and C21 to C25 each looked at: C21 the box with zealous picked and "Opens in a new tab"; C22 the new tab (two tabs, back button, zealous alone with 8 places, Other forms zeal 16 and zealously 2); C23 after Back (zeal, 16 places, the old tab beside it); C24 J clicked (386 words, 7,805 places, X dimmed, Back to zealous); C25 the NUMBER row for H7068 (43 places) and the SOUNDS LIKE row for H3657. No verse is typed: the place lines are `wb uses` fragments in `data/concordance-zeal.json`, with the marked word shown as the printed concordance does; `concordance.py` asserts every group's count against the entry and `wb` (`:514`).
- **9 No interpretation: pass.** C21-C25 show forms, entries, counts and places only; the added words are labels ("Opens in a new tab", "Other forms", "Sounds like", "Back to zealous"). The numbers and sounds are rows of `wb define`'s answer, not suggestions about meaning.
- **10 Format changes are designed: pass.** No study-folder format changes: the forms choice is a setting, a save is [library](../library/README.md)'s question, and the trail and a tab's history are [tab-history](../tab-history/README.md)'s and [minimize](../minimize/README.md)'s (the trail exists as `wb history`); this folder writes nothing new to the study folder.

**Inferences the person has not seen** (each recorded by overseer from existing decisions): C-9 (a long word's page is C1's under book headings), C-11 (the letter after a search, which is the person's own idea but not yet reviewed), C-12 (numbers and sounds behind the other suggestions, at most 3 rows each, a typed number first) and C-13's wording of the new tab (named for the word, beside the old one, one step back at a time).

For the person, to decide acceptance, in this order: C22 (the picked word's new tab, with its back button and other forms), C21 (the box with the pick), C23 (after Back), C24 (a letter after a search), C25 (numbers and sounds), then C19 heart (C-9), C20 small words, C15, C16, C17, C18, and C8 (Save's mark and per-occurrence counts). C1-C7, C9, C10 and the round 3 and 4 scenes are as the person reviewed them. The back button itself is only a first drawing here; [tab-history](../tab-history/README.md) designs it for every tab and has no sheets yet, so the Concordance's build can start only with that button taken as tab-history's.

A book on the rail, like the printed Strong's on a desk: "it would really show the whole concordance how it usually
shows if you opened a Strong's concordance", with an easy navigator to find a word quickly and the interlinear for a
verse, passage or chapter (the person, 2026-11-11). It replaces today's word-study panes (Strong's entry, Every use)
as the place they live; a word study opened from it is minimized back into it (see
[minimize](../minimize/README.md)). BDB and Webster's 1913 are separate books on the rail, not tabs here.

## Leading design (2026-11-12)

Rounds 1 and 2 reviewed (2026-11-11), round 3 and round 4 shot 1 reviewed (the person, 2026-11-16); every window leads (C-8, 2026-11-16: C2-C10 lead; C1 leads for the page, with C7 added for its forms switch). C8 was redrawn 2026-11-16 (Save's mark, per-occurrence counts). C15-C20 are drawn 2026-11-16 for the real conditions; they are new windows, not a new direction, and the person has not seen them. C11-C14 are round 3's interlinear and way back (reviewed below); the real-conditions windows were first numbered C11-C14 too and were renumbered C15-C20 on the merge (see Numbering).

| Part | Leading | Superseded (and by what) |
|---|---|---|
| The English page and the box | C1, C2 |  |
| The dictionaries | C3, C4 |  |
| Interlinear; from the reader and back | C11a, C12 (per verse, redrawn), C13 (opens where clicked), C14b; cards: fit | C5, C6 (by round 3) |
| An entry's every place; the word card's door | C7-C10 |  |
| The real conditions: among other tabs, floated, narrow, years of study | C15-C20 |  |
| Picking a word, a letter after a search, numbers and sounds (round 4's decisions) | C21-C25 | the three `c02-pick-*` scenes (a, b, c) were the options; the person chose a and c, drawn as C21-C23 |

## Decisions (2026-11-16)

The person's own decision of 2026-11-16 is the verse card's single "In the Concordance" door (see [words](../words/README.md)),
which C-4 and the build list below rely on. The rest of this table is decided by overseer from existing decisions
(rounds 1-2 reviewed, the person, 2026-11-11), dated 2026-11-16, and rests on the lines named.

| # | Decision | Rests on |
|---|---|---|
| C-1 | The English page is as drawn (C1); All forms / This word is a choice that is kept (C7), for a page opened by a letter, a number or a reference. A word picked from the box opens alone with its other forms a click away, in a new tab (the person, round 4: a and c, below; the person's decision wins over this row's earlier wording). | Round 1 review; Round 2 review; Round 4 review, shot 1 |
| C-2 | The word list is the KJV's words; the commonest small words appear with references only. | Round 1 review; Round 2 review |
| C-3 | A dictionary tab shows the entry and its every place: 4 lines per group and "N more", grouped by English word (C8) or by book (C9), counted per occurrence. | Round 1 and 2 reviews; the build note |
| C-4 | A place line's reference opens the verse card of [words](../words/README.md) W4; there is no second pop-up design. | Round 2 review; words option B (the person) |
| C-5 | One index of every Strong's word (b537): the Concordance's Hebrew and Greek tabs, in number order (C3, C4). [Books](../books/README.md) K3 is that same list opened at BDB, not a second index. | Decisions of 2026-11-11; [overlaps](../overlaps.md) |
| C-6 | Count, forms and near: [search](../search/README.md) owns how they are asked and drawn (R8-R10, R6). The Concordance hosts them for an entry and reuses those controls. `wb uses`, `count`, `forms`, `near` stay. | search README; Round 1 review |
| C-7 | Save in the Concordance is [library](../library/README.md)'s mark (S5), on an entry and on a place. Library owns it; this folder only places it. | library S5 |
| C-8 | Leading table: C2-C10 lead; C1 leads for the page, with C7 added for its forms switch. | Rounds 1-2 reviewed |
| C-9 | **An inference, not stated by the person; C19 shows it.** The English page is C1's page at any size: the places in Bible order, C7's switch at its head, nothing else above the list. A word with 100 places or fewer (one page of `wb uses`) is one run, as C1 draws zeal. A word with more (heart, 830) shows the same places under their books in Bible order, each book with its count, 4 lines and "N more", the pattern the person kept for an entry's places. The small words run their references the same way, first ones and "N more". Whole Bible and Near stay an entry's tools (C-6, C8): on the English page a place's number opens its entry, and the tools are there. | the person, 2026-11-11 ("reads like the printed Strong's"); C-1; Round 2 review (4 lines and "N more"; C9 kept); [complaints](../../research/bible-software-complaints.md) (a common word returning too many hits) |
| C-10 | C-4 in practice: the verse card on C15 and C18 is [words](../words/README.md)' card, drawn from `words.py` or exactly as W4 and W10 draw it: same frame, handle, verse numbers, tab labels (words W-9: In the Concordance, whole) and Read the chapter. This folder changes nothing on it. | C-4; words W-9 |
| C-11 | **What a letter does after a search (round 4's open question):** the person's idea, as drawn in C24. The letter shows only the words that start with it (`wb forms j`: 386 words, 7,805 places) and only those words can be clicked; a letter with no words (X, `wb forms x`: 0) is dimmed and cannot be clicked. The letter does not clear the search: the line at the head of the letter's page, Back to zealous, returns to it. | The person, round 4, shot 1 (the idea, and "letters with no words, like X, can't be clicked"); [complaints](../../research/bible-software-complaints.md) (a history that clears with each new search, Accordance) |
| C-12 | **Numbers and sounds in the box (round 4's open question):** yes, as the person said "worth testing, so long as it does not get in the way of the other searches". They are two more groups behind the existing ones (English forms, then original words whose definition holds it, as C2 draws): NUMBER, shown only when what is typed is a Strong's number (`wb define H7068`), and SOUNDS LIKE, shown only when what is typed matches an original word's transliteration (`wb define kanna`), at most 3 rows each. A typed number goes first, being exact; otherwise neither group is ever above the other searches, and typing `zea` still gives C2's list unchanged. Drawn in C25. | The person, round 4, shot 1; [complaints](../../research/bible-software-complaints.md) (a Strong's number shown but not opening anything, a common word returning too many hits) |
| C-13 | **Picking a word, drawn (the person's choice of a and c, round 4):** the English word chosen in the box opens in a new tab (C21), the tab named for the word, beside the old one, showing the word alone with its other forms a click away (`wb forms`) in the row at the foot and in All forms (C22). The new tab is a copy of the tab it came from, with that tab's history; its back button goes one step back through that history and leaves the old tab as it was (C23). How history, the button and the trail work in every tab is [tab-history](../tab-history/README.md), not this folder. | The person, round 4, shot 1 (a and c; "a back button in the tab goes back through it"); round 3 review (each move is a step on the trail) |

## Decisions (the person, 2026-11-11)

- **The Concordance is a book on the rail**, its own button (the minimize rounds, H-L).
- **It reads like the printed Strong's**: English words A to Z, each place with a few words around it and the number of
  the original word.
- **Hebrew and Greek are tabs inside the Concordance**, not books of their own.
- **The interlinear is offered inside it**, for a verse, a passage or a chapter.
- **BDB and Webster's 1913 are books of their own** on the rail.

## Open questions

- ~~What does a letter do after a search?~~ Settled: C-11 (the person's idea, drawn in C24); struck 2026-11-16.
- ~~Does the box also suggest numbers and sounds?~~ Settled: C-12 (behind the existing suggestions, drawn in C25); struck 2026-11-16.
- ~~Picking a word is decided (a and c) but not drawn.~~ Drawn: C21-C23 (C-13); struck 2026-11-16.
- ~~Round 1 (C1-C6): is the English page right as drawn? Every form together or one word at a time?~~ Settled: C-1 below (the page as drawn; All forms / This word is a choice that is kept, C7); struck 2026-11-16.
- ~~How far does the word list reach?~~ Settled: C-2 below (the KJV's words; the commonest small words with references only); struck 2026-11-16.
- ~~What does "In the Concordance" replace on the word card: today's Strong's and Every use actions, or sit beside them?~~ Settled by the person in the [Round 1 review](#round-1-review-the-person-2026-11-11) (it replaces them) and kept in the [Round 2 review](#round-2-review-the-person-2026-11-11); struck 2026-11-16.
- ~~Do the dictionary tabs show the open entry's every use or only the entry?~~ Settled: C-3 below (the entry and its every place); struck 2026-11-16.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-11 | C1-C6 | English page with word list and entry margin (C1), one search box for words, numbers and sounds (C2), Hebrew and Greek dictionary pages in number order (C3, C4), interlinear for a passage (C5), from the reader's word card into the book with the place marked (C6) | Round 1 review below |
| 2 | 2026-11-11 | C7-C10 | All forms / This word switch (C7); an entry with every place, grouped by English word (C8) or by book (C9), with Whole Bible and Near tools; the word card with one In the Concordance door and a map of where its old actions go (C10) | Round 2 review below |
| 3 | 2026-11-16 | C11-C14 | The interlinear and the way back: one verse with a word opened, its parsing and entry under the verse (C11, Greek); a whole chapter with one verse's words open at a time (C12); the interlinear beside the reader, following its verse (C13); deep in the book, a From Numbers 25:11 line with Back to the verse (C14). Hebrew lines read right to left, first word on the right. Redrawn the same day in the real app, mid-study, each question both ways and long words on the cards both ways (`scenes/round3-*.png`, made by `node design/features/concordance/scene.mjs`) | Round 3 review below |
| 4 | 2026-11-16 | (scenes C1-C14 redrawn in the real app) | The whole design redrawn off the code on the installed app (`scenes/c*.png`, `scene.mjs`), shot 1 reviewed: the box, picking a word drawn three ways (`c02-pick-*`), a letter after a search (`c02-letter-after-a-search`) | Round 4 review below |
| 6 | 2026-11-16 | C21-C25 | Round 4's decisions drawn: the box with a word picked (C21), the new tab with the word alone, the other forms a click away and its back button (C22), the new tab after Back (C23), a letter clicked after a search (C24), numbers and sounds in the box (C25) | no new direction: each draws what the person decided in round 4, or settles its open question by C-11 to C-13; the person sees these when deciding acceptance |
| 5 | 2026-11-16 | C15-C20 | The real conditions (the person, 2026-11-13): the Concordance among other tabs with words W4's verse card open from a place line (C15), floated small (C16), narrow as a side pane (C17) and at phone width (C18), years of study: heart with 830 places, 4 lines per book and "N more" (C19), and the small words with references only (C20); C8 redrawn with Save's mark and per-occurrence counts | no new direction; the person sees these when deciding acceptance |

## Scenes in the real app (from round 3)

At the person's request (2026-11-16), rounds are drawn off the code where they can be: `scene.mjs` runs the person's
installed app (`%LOCALAPPDATA%\bible-workbench-rs\app`, or `WB_APP_DIR`) on its own copy of the scratch study folder
(the person's notes, highlights and trail, never the real folder), makes a few real lookups, then mounts the
Concordance as a prototype pane, one tab, with the dock's own `open()`, drawn with the app's CSS classes and tokens.
Everything around it is the app as built (the word sheet in C10 is the app's own, its actions swapped as decided);
every word in the pane is a `wb` answer. The FigCraft board stays for the earlier rounds.

**The whole design, redrawn on the install of 2026-11-16 (14:19)**, as the decisions of rounds 1-3 stand, for the
thorough review (`node design/features/concordance/scene.mjs`, shots in `scenes/c*.png`):

| Shot | Window | As decided |
|---|---|---|
| `c02-search` | C2 | One box: English forms with their counts, then original words defined with the word |
| `c01-english-page` | C1 + C7 | All forms (zeal, zealous, zealously), each place a short line with its number; a number opens its entry under the line (in the narrow column, not a right margin) |
| `c08-hebrew-by-english-word` | C8 | H7068 with every place, grouped by rendering, 4 lines and N more |
| `c09-greek-by-book` | C9 | G2205 grouped by book, the counts as bars |
| `c10-word-card-door` | C10 | The app's word sheet with one In the Concordance door, BDB and Webster's |
| `c11-verse-word-opened` | C11a | The word opens under the verse; Every place only if wanted |
| `c12-chapter-toggles` | C12 | Each verse toggles its words; Expand all, Collapse all |
| `c13-opened-from-the-reader` | C13 | Opened from Numbers 25:11 · zealous, that word picked; then the person's to move (‹ 25:10, 25:12 ›) |
| `c14-before-back-to-the-verse`, `c14-back-at-the-verse` | C14b | From Numbers 25:11 and Back to the verse; then the book stays open beside the reader |

C3 and C4 (the dictionaries in number order, A to Z by the original's letters) are shown only as the letter strip
under the box here; their pages have not been redrawn.

## Round 4 review, shot by shot (the person, 2026-11-16)

**Shot 1, C2 (the box):**
- **The Concordance keeps its own box**: the top bar stays for opening other tabs. While the Concordance is in front,
  the top bar may also search it.
- **The suggestions are liked** (English forms, then original words defined with the word). Suggesting numbers and
  sounds as well is worth testing, so long as it does not get in the way of the other searches.
- **Picking a word: open, to be worked out.** Drawn three ways for the next look: the word alone with the other forms
  a click away (`c02-pick-a-this-word`), the word alone with All forms beside it (`c02-pick-b-all-forms-at-hand`), and
  the word in a tab of its own (`c02-pick-c-own-tab`).
- **Picking a word: a mixture of a and c** (decided after the drawings). The picked word opens alone with its other
  forms a click away (a), in a new tab (c). The new tab is a copy of the tab it came from, with that tab's history, and
  a back button in the tab goes back through it. Going back inside a tab is wanted in every tab, not only here, so it
  is designed as an app-wide feature of its own (with the trail rule above), not in this folder.
- **The letter strip earns its place at the opening of the book.** What a letter does after a search is to be worked
  out; the person's idea: the letter shows only the words that start with it, and only those can be clicked. Drawn as
  `c02-letter-after-a-search` (J clicked after zealous; letters with no words, like X, can't be clicked).
- **A place line names its original word's number** (as drawn on the English page). The person wants a **KJV+** view
  (the KJV with Strong's numbers in the text, as many students of Strong's use): its own design, not part of this
  folder.

**Decided by overseer from existing decisions (inference), 2026-11-16:** the three open items of this round are settled
as C-11 (the letter after a search, the person's idea as drawn), C-12 (numbers and sounds behind the other suggestions)
and C-13 (picking a word, drawn as C21-C23); they are drawn in round 6 (C21-C25). The person has not reviewed them.

## Data the sheets show

Fetched with the release `wb` (the C15-C20 files and `uses-H7068-G2205.json` on 2026-11-16 by `python concordance.py --fetch`; the rest on 2026-11-11), with `WB_BIBLE_DB` set to the Python checkout's `datasets/workbench.db`
and `WB_STUDY_DIR` set to an empty scratch folder (nothing written). Never edit by hand; refetch.

| File | Made by |
|---|---|
| `data/concordance-zeal.json` | `wb uses zeal`, `wb uses zealous`, `wb uses zealously`; for each place, the marked word with four words either side, and its number from `wb word <BOOK> <c> <v> <i>` |
| `data/forms-zea.json` | `wb forms zea` |
| `data/lexiconc-zeal.json` | `wb lexiconc zeal` |
| `data/strong-entries.json` | `wb strong <n>` for H7062-H7070 and G2203-G2208 |
| `data/interlinear-num25-11-12.json` | `wb interlinear "Num 25:11-12"` |
| `data/uses-H7068-G2205.json` | `wb uses H7068`, `wb uses G2205` (every page, `--offset`); one entry per marked word, so per occurrence (2026-11-16: H7068 43 places, jealousy 24), with six words either side |
| `data/books.json` | `wb books` |
| `data/interlinear-num25.json` | `wb interlinear "Num 25"` (2026-11-16) |
| `data/interlinear-john2-17.json` | `wb interlinear "John 2:17"` (2026-11-16) |
| `data/uses-heart.json` | `wb uses heart` (every page): the totals (830 in 762 verses), the count per book, each book's first 4 places per occurrence, and the number of the original word from `wb word` for the first six books' lines (C19: the English page under C7's switch, C-9) |
| `data/uses-small-words.json` | `wb uses and`, `wb uses the`, `wb uses of`: the totals and the first page's references (C20) |
| `data/text-num5-14.json`, `data/interlinear-num5-14.json` | `wb text "NUM 5:14"` and `wb interlinear "NUM 5:14"`: the verse of H7068's first place, which words' verse card opens (C15, C18): `words.verse_card` is given the text, and the interlinear file supplies the reference |
| `data/text-num5-reader.json` | `wb text "NUM 5:12-16"`: the reader beside the Concordance (C15) |
| `data/letters-forms.json` | `wb forms <letter>` for a to z (words and places per letter; X has none) and the first 60 forms of j (C24), by `python concordance.py --fetch6` (2026-11-16) |
| `data/box-suggestions.json` | `wb define H7068`, `wb define kanna`, `wb forms zealous`, `wb lexiconc zealous` (C21, C25), by `--fetch6` |

## What the build must satisfy

Built on `feature/concordance-build` (2026-11-16); ticked lines are built and tested (`crates/wb-cli/tests/concordance.rs`, `ui/tests/concordance.spec.ts`). Not ticked, and why: picking a word (its new tab is built; the back button is [tab-history](../tab-history/README.md)'s), Save (library's `wb save` and S5 mark do not exist yet), the return case and real conditions (to be checked in the real app), the single door (here only the word sheet's Every use became In the Concordance; the verse card and the BDB / Webster's buttons are [words](../words/README.md)' build), and the commands (`wb save` missing). The windows are drawn (C1-C25; C11-C14, the interlinear and the way back, are also the real-app scenes).

- [x] The rail's Concordance button opens one tab with four tabs inside: English, Hebrew, Greek, Interlinear.
- [x] English: typing `zeal` shows the words `wb forms zea` lists with the same counts; the page for a word shows exactly the places `wb uses <word>` returns, in Bible order, each with words either side of the marked word and its Strong's number. `zeal` (16 places) is one run with no book headings. `heart` (830 places, more than 100) shows them under 54 book headings in Bible order, each heading's count equal to `wb count heart` for that book, 4 lines and "N more" per book, and "N more" shows the rest of that book (C-9). A small word (and, the, of) shows references only, no words around them. With This word chosen, closing and reopening the window still shows This word.
- [x] Hebrew and Greek: entries are in number order (H7068 follows H7067), and ← → open the previous and next number. An entry lists every occurrence, grouped by English word or by book, 4 lines per group and "N more". Each group's count equals the entry's rendering count (H7068: jealousy 24 lines, not 22).
- [x] Interlinear: `Num 25:11` (a verse), `Num 25:11-12` (a passage) and `Num 25` (a chapter) each show, for every verse, the KJV text and the words `wb interlinear` returns for it, with their numbers.
- [x] Every line of scripture on screen equals `wb text` for its reference, character for character; fixtures are generated from the database.
- [ ] Picking a word from the box (the person, round 4: a and c; C21, C22, C23): with `zealous` typed, choosing the English word `zealous` opens a new tab named zealous beside the old one, which keeps its page; the new tab shows exactly the 8 places `wb uses zealous` returns and, at the foot, the other forms `wb forms zea` lists (zeal 16, zealously 2) as buttons, each of which opens that form's page; All forms shows zeal, zealous and zealously together. The new tab starts with the old tab's history; its back button goes one step back to the page the old tab was on, and a second goes to the step before that; the old tab is unchanged after either. Scripture on the page equals `wb text`.
- [x] A letter after a search (C-11, C24): with `zealous` searched, clicking J shows `wb forms j`'s 386 words with their counts and no others, each clickable; clicking X does nothing and X is dimmed (`wb forms x` is empty); a letter with words is never dimmed. Back to zealous returns to the search page, unchanged.
- [x] Numbers and sounds in the box (C-12, C25): typing `H7068` shows one NUMBER row, H7068 with the lemma, sound, definition and 43 places that `wb strong H7068` returns, and nothing above it; typing `kanna` shows a SOUNDS LIKE row for H3657 as `wb define kanna` lists it; typing `zea` shows exactly the rows C2 shows and neither group; a group never has more than 3 rows. A number or sound row opens its entry in a new tab, like a picked word.
- [ ] Save (K) on an entry and on a place line shows [library](../library/README.md) S5's mark filled, and the save is listed by `wb shelf` (C-7).
- [ ] **Return case, the reader's place is kept (5f45):** from a place line, the reference opens the verse card over the Concordance. Read the chapter goes to the reader at that verse with the verse selected (2c00). Back returns to the same entry, group and scroll position, and the reader's earlier place is restored. The same holds for C6: reader, word card, door, and back to the word.
- [ ] The word card and the verse card have one door; no Strong's or Every use buttons remain. The word card keeps C10's BDB and Webster's buttons, which open those books ([words](../words/README.md) W-8).
- [x] Nothing is suggested: no related words, no commentary; only entries, places and counts.
- [ ] Commands. Existing: `wb strong`, `uses`, `count`, `forms`, `near`, `lexiconc`, `interlinear`. Missing, so required:
  - `wb concordance <word> [--forms all|one]` for the English page's lines;
    (built, with `wb concordance box <text>` for the box's suggestions, `wb concordance letters` for the letter strip and `--book <code>` for one book's every line; with no `--forms` the kept choice, and until one is kept This word, so the page agrees with the box's count, `wb count` and `wb uses`: heart 830);
  - `wb strong <n> --next|--prev` and `wb strong --list hebrew|greek [--from <n>]`;
  - `wb uses <n> --by word|book`, per occurrence;
  - `wb interlinear "Num 25"` already takes a chapter (run 2026-11-16), so nothing is missing there;
  - `wb settings reading word-click card|concordance` for the click-on-a-word choice, and `wb settings concordance forms all|one` for the kept forms choice. Run 2026-11-16 on a scratch folder: `wb settings` has the parts notebook, reading, hover, theme, advanced, toolbar and commands; `reading` stores any key and value, and nothing in the app reads `word-click`, so required: the app obeys it and takes only `card` or `concordance`. `concordance` is not a part, so that line is missing whole;
  - Save is [library](../library/README.md)'s `wb save <thing> [--folder <f>]`, named there as missing;
  - the box's letters, numbers and sounds are `wb forms <letter>` (run 2026-11-16: j 386 words, x none), `wb define H7068` and `wb define kanna`, all existing; the new tab is a step on the trail, `wb history add word <number> --line "<the line>" --from <step id>` (existing, `--from` forks); the back button's own command is [tab-history](../tab-history/README.md)'s, named there as required.
- [ ] Real conditions are checked in the app on a generated study (below). As one tab beside the reader and a page, opening the verse card from a place line and closing it leaves all three panes, the entry, its group and its scroll as they were. Floated at 420 wide and docked at 360, the search box, the four tabs, the entry's Save mark and each place's reference, marked word and Save mark are all shown, nothing cut. At a 390-wide window the Concordance fills the screen and the verse card is words' sheet (C-10). `heart` and `and` open within the speed budget (`npm run measure`).

### The real conditions (the person, 2026-11-13)

Drawn 2026-11-16 in round 5 (not yet reviewed by the person).

| Condition | Window | Reused from the person's round 3 and 4 work |
|---|---|---|
| Among other tabs | drawn: C15 (the reader, a page and the Concordance as three tabs in panes; words W4's verse card open from the first place line) | The Concordance beside the reader is also the real-app scene `round3-c13-a-follows-the-reader` and the round 3 C14 window with `round3-c14-b-stays-open-beside` (the book stays open beside the reader, the person's decision). Not redrawn: that part. Not covered by them, so C15 stays: a third pane (a page), and the verse card opened from a place line over the panes. |
| As a floating tab | drawn: C16 (floated small over the reader, 420 wide; controls stacked, three words either side) | None of the round 3 or 4 windows floats the Concordance (their C14a minimizes it to the rail). C16 stays. |
| Narrow | drawn: C17, a 360-wide side pane, and C18, phone width (390 wide, the verse sheet from the bottom) | None of them is narrower than the desktop window. C17 and C18 stay. |
| Years of study | drawn: C19, heart (830 places, 54 books, 4 lines and "N more" each), and C20, the small words and, the, of with references only (C-2) | The round 3 and 4 scenes show zeal and H7068, 43 places at most (`c01-english-page`, `c08-hebrew-by-english-word`), so they do not show a long word or a small word. C19 and C20 stay. |

The direction is settled; the six windows (C15-C20), C8 (Save's mark, per-occurrence counts) and round 4's C21-C25 are drawn. C19's heart page (C-9), C18's phone sheet and C15's card (C-10) were redrawn several times on 2026-11-16; the phone sheet sits on the window's bottom and C15's place lines are four words either side so none is cut. The person has not seen C15-C20 or accepted the folder.

## Inferences made in the build (2026-11-17), for the person to look at

- **The small words** (given with references only, C-2) are a fixed list; the design names only and, the and of. The list is: a, an, and, are, as, at, be, but, by, for, from, had, has, have, he, her, him, his, i, in, is, it, me, my, not, of, on, or, our, shall, that, the, their, them, they, thee, thou, thy, to, unto, us, was, we, were, which, with, ye, you, your. Such a word is shown alone, with no "Other forms".
- **The default of This word / All forms** is This word until the person chooses All forms (then it is kept), because the box's count, `wb count` and `wb uses` count the word alone (heart 830); C-1 says only that the choice is kept.
- **Enter on a typed word** opens its tab like a click on the suggestion (C-13); a typed number does the same; a place goes to the Interlinear tab of the tab in front. Text starting with a dash is refused.
- **A word clicked in the letter list** opens in the same tab (the letter does not clear the search, C-11).

## Out of scope / later

- ~~The Notebook and the Shelf together, and what a bookmark means in the app.~~ The bookmark is [library](../library/README.md)'s Save (C-7, 2026-11-16).
- The trail ([minimize](../minimize/README.md)): the Concordance's steps join it like any tab.

## Numbering (the merge of 2026-11-16)

Two lines of work reached this folder with the same names. The person's round 3 and round 4 work (interlinear and way
back, drawn as C11-C14 on the board and as the scenes `scenes/c11-*` to `c14-*`, `round3-*`; picking a word, `c02-pick-*`)
kept the names C11-C14. The real-conditions windows (among other tabs, floated, narrow, years of study) had also been
numbered C11-C14, so they were renumbered, by the overseer, to the next free numbers after the highest sheet on the
board (C14): one number per sheet, C15 among other tabs, C16 floated, C17 narrow side pane, C18 narrow phone, C19 heart,
C20 the small words. They sit on the board as "Round 5" (round 4 is the review of the scenes). No window was dropped, and
C8 and C9 keep the Save mark and per-occurrence counts on the same sheets.

C21-C25 (round 6, round 4's decisions drawn) are the next free numbers after C20.

Decisions of this folder were compared. One conflict was found: C-1 (and C7) keep the All forms / This word choice
across pages, while the person's round 4 review says a picked word opens alone, with its other forms a click away
(a), and in a new tab (c). The person's decision wins: C-1 below now says the kept choice applies when a page is opened by
a letter, a number or a reference, and a word picked from the box opens alone. C19's This word is that case, and not a change.

## Round 1 review (the person, 2026-11-11)

- **Forms: a choice, not a rule.** The English page offers all forms of a word together (zeal, zealous, zealously) and
  the one word alone; the reader picks, and the choice is kept (round 2, C7).
- **The word list.** The person understood Strong's as mapped to the KJV only and asked what "the full printed list"
  means. Answer given: the printed concordance does index the KJV's words, but the commonest small words (and, the,
  of ...) are given with references only, in an appendix, and words the translators supplied (italics) carry no
  number. So the open choice is only whether those small words appear.
- **"In the Concordance" replaces** the word card's Strong's and Every use actions; their capabilities (count by book,
  forms, defined by, near, every use) move inside the Concordance (round 2, C10).
- **A dictionary entry lists its places**, like BibleHub: every place the original word stands, the English it is
  rendered by marked (round 2, C8, C9).

## Round 2 review (the person, 2026-11-11)

- **Places under an entry: 4 lines and "N more"** per group, as drawn (C8).
- **A place line keeps a few words around the word**, as drawn. Its reference opens the verse (a pop-up, or to the
  reader); that pop-up is designed with the rest of the app's verse cards so it fits them, not on its own.
- **Small words are included as the printed book does**: the commonest words with references only.
- C7 (All forms / This word), C9 (by book) and C10 (the word card's one door, the old actions moved inside) are kept
  as drawn.
- Build note: the entry's rendering counts are per occurrence (H7068: jealousy 24), the drawn groups were per verse
  (22); the build lists every occurrence so the two agree.
- Next: the Notebook, the Shelf and what a bookmark means ([library](../library/README.md)).

## Round 3 review (the person, 2026-11-16)

- **Moving inside a tab is a step on the trail**: inside the Concordance, a dictionary, the reader or any other tab,
  each move is its own step.
- **Long original words: A, fit.** The cards stay an even grid; a long word's type shrinks until it fits its card
  (`scenes/round3-cards-a-fit-*.png`; B, grow, was not chosen).
- **C11: a, the word opens under the verse**, keeping the verse, the word, its parsing and its entry together. Every
  place is a separate step the reader takes only if they want it, never forced.
- **C12: the words are a toggle per verse**: each verse can be expanded or collapsed, and all at once with Expand all
  and Collapse all (redrawn as `scenes/round3-c12-toggles.png`).
- **C13: it opens where the reader clicked.** Opened from a word or verse in the reader, the interlinear goes to that
  word or verse; after that it does not follow the reader, and the person may go to any other verse or word in it.
- **C14: b, the book stays open beside the reader.** Back to the verse puts the reader on the verse; the book stays
  on its page.
