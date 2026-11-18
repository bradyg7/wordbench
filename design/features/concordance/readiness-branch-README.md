# The Concordance

**State:** exploring (rounds 1-2 reviewed; the real conditions drawn 2026-11-16) · **Sheets:** `python -I design/features/concordance/concordance.py` writes `concordance.figcraft`
and `concordance.pdf` (the board, one vector page; it imports words' `verse_card` and `verse_phone_sheet`) · Nothing here is built yet. What other tools get wrong, and so what this folder avoids:
[bible-software-complaints](../../research/bible-software-complaints.md).

**Readiness: likely finished** (2026-11-16, fourth pass, by [ready-criteria](../ready-criteria.md); never "accepted", which is the person's word). The overseer re-checked all ten on its own evidence: `concordance.py` read whole, every `data/` file compared with a fresh `wb` run, and the board (`concordance.pdf`) rendered and looked at window by window (C11, C12, both C13, both C14). Two small flaws were found and redrawn on this pass (below). All ten pass.

- **1** rounds 1 and 2 are reviewed and every window leads (Leading design; the two reviews below). C11-C14 draw that design in the real conditions and propose no other direction; they are what the person looks at to accept ([ready-criteria](../ready-criteria.md), check 1's note). C-9 is the one inference they carry, labelled as such here, in its row and in C14's caption.
- **2** all four open questions are struck (Open questions); C-9 and C-10 settle what the builder left "for the overseer to weigh".
- **3** every cell is drawn and seen on the board: among other tabs C11 (`concordance.py:605`), floated C12 (`:624`), narrow C13 as a 360 side pane (`:642`) and at 390 (`:653`), years of study C14 (`:662`, `:681`).
- **4** the build list below; each line names its input and result; the return case is its seventh line.
- **5** run 2026-11-16 with the release `wb`: `strong`, `define zeal`, `uses H7068 --scope ot`, `uses heart --offset`, `count heart`, `forms zea`, `lexiconc zeal`, `near zeal LORD`, `interlinear "Num 25"` (a chapter), `reader`, `verse`, `shelf` all answer (`crates/wb-cli/src/read.rs:57`, `:63`, `:66-67`, `:68`, `:76`, `:79`, `:82`, `:87`, `:98`, `:109`). Missing as the Commands line says: `wb concordance`, `wb strong --next` and `--list`, `wb uses --by`, `wb settings concordance`, `wb save` (each refused when run). The Commands line's note on `wb settings` was wrong and is corrected on this pass: the `reading` part exists and stores any key, but nothing reads `word-click`.
- **6** [overlaps](../overlaps.md): the Strong's index (`:42`), count/forms/near (`:43`), Save's mark (`:44`), the word card (`:39`) and the verse card opened from the Concordance (`:40`, its stale "to be redrawn" sentence corrected on this pass) are resolved or agree; [coverage](../coverage.md) gives the Concordance one folder (`:19`).
- **7** the click-on-a-word choice is [settings](../settings/README.md)'s accepted Reading line (`settings/README.md:112`); the rail button is [minimize](../minimize/README.md)'s (`:17`, `:69`). The fetch opens the database through `wb` with `WB_STUDY_DIR` set to an empty temp folder (`concordance.py:49-51`), never the person's folder.
- **8, sheets match the README:**
  - **C14, heart** (`concordance.py:662-679`) matches C-9: C7's All forms / This word switch at its head (`switch_head`, `:210`, the function C7 calls at `:507`), nothing else above the list, no tools row (no By book, Whole Bible or Near; those stay on C8 and C9 through `tools`, `:406`). The places run under their books in Bible order, each with its count, 4 lines and "N more"; H is the navigator's letter. Counts equal a fresh `wb uses heart` (every page) and `wb count heart`: 830 places in 762 verses and 54 books, every book's count equal to `data/uses-heart.json`. The 26 place lines of the first eight books were each found inside `wb text` for their verse.
  - **C11's card** (`:621`) and **C13's phone sheet** (`:659`) are words' own drawing: `WD.verse_card` and `WD.verse_phone_sheet` (`words/words.py:93`, `:112`), given `wb text "NUM 5:14"` (`:569`, `data/text-num5-14.json`). There is no local card. Seen on the board: handle with float and close, the verse number, Interlinear / In the Concordance / Definitions whole on one line, Read the chapter (C-10, words W-9).
  - No label is cut in C11, C12, C13 or C14: the four tabs, the search box, By English word / By book, Whole Bible, Saved and every rendering chip are whole at 684, 420, 360 and 390 wide.
  - Redrawn on this pass: C13's phone sheet stopped above the window's bottom with two place lines showing under it (now words' sheet reaches the bottom); C11's third place line ran under its Save mark and lost its closing dots (C11 now draws four words either side, `:620`, cut from the data by `trim`, `:367`).
  - The navigator's letter is the letter of the word shown (`:150`): H for heart, T for the, Z for zeal. C11's top bar says Numbers 5 over its Numbers 5 pane (`slim_bar`, `:218`).
  - Counts agree, and the script now asserts it for every group (`:480-490`, added on this pass): H7068's six groups equal the entry's renderings (jealousy 24, zeal 9, envy 7, envied 1, jealousies 1, sake 1; 43) and G2205's eight (17), and both equal `wb strong` and `wb uses` run today. C1, C2 and C7: zeal 16, zealous 8, zealously 2 in `data/forms-zea.json` equal `wb forms zea` and the lines in `data/concordance-zeal.json`. The small words' totals and first references equal `wb uses and|the|of`. `data/text-num5-14.json` and `data/text-num5-reader.json` equal `wb text` character for character. No verse is typed in `concordance.py`. C8 has Save's mark on the entry and each place (`save_mark`, `:173`). No Strong's or Every use button is on the board: C10 has the door, BDB and Webster's; "Every use" stands only in C10's map of where the old actions went.
- **9** C1-C14 show entries, places, references and counts only; the added words are labels ("references only", "N more"). The board's text holds no suggestion, related word or commentary.
- **10** no study-folder format changes: the forms choice is a setting, and how a save is kept is [library](../library/README.md)'s question.

For the person, to decide acceptance, in this order: C14 heart first (it shows C-9, the one inference: is a long word's page right under book headings, with no tools row?), then C14 small words, C11, C12, C13 side pane, C13 phone, and C8 (redrawn with Save's mark and per-occurrence counts). C1-C7, C9 and C10 are as the person reviewed them.

A book on the rail, like the printed Strong's on a desk: "it would really show the whole concordance how it usually
shows if you opened a Strong's concordance", with an easy navigator to find a word quickly and the interlinear for a
verse, passage or chapter (the person, 2026-11-11). It replaces today's word-study panes (Strong's entry, Every use)
as the place they live; a word study opened from it is minimized back into it (see
[minimize](../minimize/README.md)). BDB and Webster's 1913 are separate books on the rail, not tabs here.

## Leading design (2026-11-12)

Rounds 1 and 2 reviewed (2026-11-11); every window leads (C-8, 2026-11-16: C2-C10 lead; C1 leads for the page, with C7 added for its forms switch). C8 was redrawn 2026-11-16 (Save's mark, per-occurrence counts). C11-C14 are drawn 2026-11-16 for the real conditions; they are new windows, not a new direction, and the person has not seen them.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| The English page and the box | C1, C2 |  |
| The dictionaries | C3, C4 |  |
| Interlinear; from the reader and back | C5, C6 |  |
| An entry's every place; the word card's door | C7-C10 |  |
| The real conditions: among other tabs, floated, narrow, years of study | C11-C14 |  |

## Decisions (2026-11-16)

The person's own decision of 2026-11-16 is the verse card's single "In the Concordance" door (see [words](../words/README.md)),
which C-4 and the build list below rely on. The rest of this table is decided by overseer from existing decisions
(rounds 1-2 reviewed, the person, 2026-11-11), dated 2026-11-16, and rests on the lines named.

| # | Decision | Rests on |
|---|---|---|
| C-1 | The English page is as drawn (C1); All forms / This word is a choice that is kept (C7). | Round 1 review; Round 2 review |
| C-2 | The word list is the KJV's words; the commonest small words appear with references only. | Round 1 review; Round 2 review |
| C-3 | A dictionary tab shows the entry and its every place: 4 lines per group and "N more", grouped by English word (C8) or by book (C9), counted per occurrence. | Round 1 and 2 reviews; the build note |
| C-4 | A place line's reference opens the verse card of [words](../words/README.md) W4; there is no second pop-up design. | Round 2 review; words option B (the person) |
| C-5 | One index of every Strong's word (b537): the Concordance's Hebrew and Greek tabs, in number order (C3, C4). [Books](../books/README.md) K3 is that same list opened at BDB, not a second index. | Decisions of 2026-11-11; [overlaps](../overlaps.md) |
| C-6 | Count, forms and near: [search](../search/README.md) owns how they are asked and drawn (R8-R10, R6). The Concordance hosts them for an entry and reuses those controls. `wb uses`, `count`, `forms`, `near` stay. | search README; Round 1 review |
| C-7 | Save in the Concordance is [library](../library/README.md)'s mark (S5), on an entry and on a place. Library owns it; this folder only places it. | library S5 |
| C-8 | Leading table: C2-C10 lead; C1 leads for the page, with C7 added for its forms switch. | Rounds 1-2 reviewed |
| C-9 | **An inference, not stated by the person; C14 shows it.** The English page is C1's page at any size: the places in Bible order, C7's switch at its head, nothing else above the list. A word with 100 places or fewer (one page of `wb uses`) is one run, as C1 draws zeal. A word with more (heart, 830) shows the same places under their books in Bible order, each book with its count, 4 lines and "N more", the pattern the person kept for an entry's places. The small words run their references the same way, first ones and "N more". Whole Bible and Near stay an entry's tools (C-6, C8): on the English page a place's number opens its entry, and the tools are there. | the person, 2026-11-11 ("reads like the printed Strong's"); C-1; Round 2 review (4 lines and "N more"; C9 kept); [complaints](../../research/bible-software-complaints.md) (a common word returning too many hits) |
| C-10 | C-4 in practice: the verse card on C11 and C13 is [words](../words/README.md)' card, drawn from `words.py` or exactly as W4 and W10 draw it: same frame, handle, verse numbers, tab labels (words W-9: In the Concordance, whole) and Read the chapter. This folder changes nothing on it. | C-4; words W-9 |

## Decisions (the person, 2026-11-11)

- **The Concordance is a book on the rail**, its own button (the minimize rounds, H-L).
- **It reads like the printed Strong's**: English words A to Z, each place with a few words around it and the number of
  the original word.
- **Hebrew and Greek are tabs inside the Concordance**, not books of their own.
- **The interlinear is offered inside it**, for a verse, a passage or a chapter.
- **BDB and Webster's 1913 are books of their own** on the rail.

## Open questions

- ~~Round 1 (C1-C6): is the English page right as drawn? Every form together or one word at a time?~~ Settled: C-1 below (the page as drawn; All forms / This word is a choice that is kept, C7); struck 2026-11-16.
- ~~How far does the word list reach?~~ Settled: C-2 below (the KJV's words; the commonest small words with references only); struck 2026-11-16.
- ~~What does "In the Concordance" replace on the word card: today's Strong's and Every use actions, or sit beside them?~~ Settled by the person in the [Round 1 review](#round-1-review-the-person-2026-11-11) (it replaces them) and kept in the [Round 2 review](#round-2-review-the-person-2026-11-11); struck 2026-11-16.
- ~~Do the dictionary tabs show the open entry's every use or only the entry?~~ Settled: C-3 below (the entry and its every place); struck 2026-11-16.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-11 | C1-C6 | English page with word list and entry margin (C1), one search box for words, numbers and sounds (C2), Hebrew and Greek dictionary pages in number order (C3, C4), interlinear for a passage (C5), from the reader's word card into the book with the place marked (C6) | Round 1 review below |
| 2 | 2026-11-11 | C7-C10 | All forms / This word switch (C7); an entry with every place, grouped by English word (C8) or by book (C9), with Whole Bible and Near tools; the word card with one In the Concordance door and a map of where its old actions go (C10) | Round 2 review below |
| 3 | 2026-11-16 | C11-C14 | The real conditions (the person, 2026-11-13): the Concordance among other tabs with words W4's verse card open from a place line (C11), floated small (C12), narrow as a side pane and at phone width (C13), years of study: heart with 830 places, 4 lines per book and "N more", and the small words with references only (C14); C8 redrawn with Save's mark and per-occurrence counts | no new direction; the person sees these when deciding acceptance |

## Data the sheets show

Fetched with the release `wb` (the C11-C14 files and `uses-H7068-G2205.json` on 2026-11-16 by `python concordance.py --fetch`; the rest on 2026-11-11), with `WB_BIBLE_DB` set to the Python checkout's `datasets/workbench.db`
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
| `data/uses-heart.json` | `wb uses heart` (every page): the totals (830 in 762 verses), the count per book, each book's first 4 places per occurrence, and the number of the original word from `wb word` for the first six books' lines (C14: the English page under C7's switch, C-9) |
| `data/uses-small-words.json` | `wb uses and`, `wb uses the`, `wb uses of`: the totals and the first page's references (C14) |
| `data/text-num5-14.json`, `data/interlinear-num5-14.json` | `wb text "NUM 5:14"` and `wb interlinear "NUM 5:14"`: the verse of H7068's first place, which words' verse card opens (C11, C13): `words.verse_card` is given the text, and the interlinear file supplies the reference |
| `data/text-num5-reader.json` | `wb text "NUM 5:12-16"`: the reader beside the Concordance (C11) |

## What the build must satisfy

Direction settled (2026-11-16, decided by overseer from existing decisions); the person has not accepted the folder. The windows are drawn (C1-C14).

- [ ] The rail's Concordance button opens one tab with four tabs inside: English, Hebrew, Greek, Interlinear.
- [ ] English: typing `zeal` shows the words `wb forms zea` lists with the same counts; the page for a word shows exactly the places `wb uses <word>` returns, in Bible order, each with words either side of the marked word and its Strong's number. `zeal` (16 places) is one run with no book headings. `heart` (830 places, more than 100) shows them under 54 book headings in Bible order, each heading's count equal to `wb count heart` for that book, 4 lines and "N more" per book, and "N more" shows the rest of that book (C-9). A small word (and, the, of) shows references only, no words around them. With This word chosen, closing and reopening the window still shows This word.
- [ ] Hebrew and Greek: entries are in number order (H7068 follows H7067), and ← → open the previous and next number. An entry lists every occurrence, grouped by English word or by book, 4 lines per group and "N more". Each group's count equals the entry's rendering count (H7068: jealousy 24 lines, not 22).
- [ ] Interlinear: `Num 25:11` (a verse), `Num 25:11-12` (a passage) and `Num 25` (a chapter) each show, for every verse, the KJV text and the words `wb interlinear` returns for it, with their numbers.
- [ ] Every line of scripture on screen equals `wb text` for its reference, character for character; fixtures are generated from the database.
- [ ] Save (K) on an entry and on a place line shows [library](../library/README.md) S5's mark filled, and the save is listed by `wb shelf` (C-7).
- [ ] **Return case, the reader's place is kept (5f45):** from a place line, the reference opens the verse card over the Concordance. Read the chapter goes to the reader at that verse with the verse selected (2c00). Back returns to the same entry, group and scroll position, and the reader's earlier place is restored. The same holds for C6: reader, word card, door, and back to the word.
- [ ] The word card and the verse card have one door; no Strong's or Every use buttons remain. The word card keeps C10's BDB and Webster's buttons, which open those books ([words](../words/README.md) W-8).
- [ ] Nothing is suggested: no related words, no commentary; only entries, places and counts.
- [ ] Commands. Existing: `wb strong`, `uses`, `count`, `forms`, `near`, `lexiconc`, `interlinear`. Missing, so required:
  - `wb concordance <word> [--forms all|one]` for the English page's lines;
  - `wb strong <n> --next|--prev` and `wb strong --list hebrew|greek [--from <n>]`;
  - `wb uses <n> --by word|book`, per occurrence;
  - `wb interlinear "Num 25"` already takes a chapter (run 2026-11-16), so nothing is missing there;
  - `wb settings reading word-click card|concordance` for the click-on-a-word choice, and `wb settings concordance forms all|one` for the kept forms choice. Run 2026-11-16 on a scratch folder: `wb settings` has the parts notebook, reading, hover, theme, advanced, toolbar and commands; `reading` stores any key and value, and nothing in the app reads `word-click`, so required: the app obeys it and takes only `card` or `concordance`. `concordance` is not a part, so that line is missing whole;
  - Save is [library](../library/README.md)'s `wb save <thing> [--folder <f>]`, named there as missing.
- [ ] Real conditions are checked in the app on a generated study (below). As one tab beside the reader and a page, opening the verse card from a place line and closing it leaves all three panes, the entry, its group and its scroll as they were. Floated at 420 wide and docked at 360, the search box, the four tabs, the entry's Save mark and each place's reference, marked word and Save mark are all shown, nothing cut. At a 390-wide window the Concordance fills the screen and the verse card is words' sheet (C-10). `heart` and `and` open within the speed budget (`npm run measure`).

### The real conditions (the person, 2026-11-13)

Drawn 2026-11-16 in round 3 (not yet reviewed by the person).

| Condition | Window |
|---|---|
| Among other tabs | drawn: C11 (the reader, a page and the Concordance as three tabs in panes; words W4's verse card open from the first place line) |
| As a floating tab | drawn: C12 (floated small over the reader, 420 wide; controls stacked, three words either side) |
| Narrow | drawn: C13, a 360-wide side pane and phone width (390 wide, the verse sheet from the bottom) |
| Years of study | drawn: C14, heart (830 places, 54 books, 4 lines and "N more" each) and the small words and, the, of with references only (C-2) |

The direction is settled; the four windows (C11-C14) and C8 (Save's mark, per-occurrence counts) are drawn. C14's heart page (C-9) and C13's phone sheet and C11's card (C-10) were redrawn on 2026-11-16 (the third pass); on the fourth pass the phone sheet was set on the window's bottom and C11's place lines shortened to four words either side so none is cut. The person has not seen C11-C14 or accepted the folder.

## Out of scope / later

- ~~The Notebook and the Shelf together, and what a bookmark means in the app.~~ The bookmark is [library](../library/README.md)'s Save (C-7, 2026-11-16).
- The trail ([minimize](../minimize/README.md)): the Concordance's steps join it like any tab.

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
