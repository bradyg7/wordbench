# Word sheet, verse sheet and hover card

> **Read [the principles](../principles/README.md) first** (2026-11-22): it says which of this folder's decisions stand under the new frame (desks, bubbles, the dock) and lists any that conflict, for the person to settle.

**State:** up for redesign (the person, 2026-11-24); was: accepted by the person 2026-11-16 (build starts on feature/words-build); was exploring · **Sheets:** `python design/features/words/words.py` writes `words.figcraft` and
`words.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · Nothing here is built yet. What other tools get wrong, and so what this folder avoids:
[bible-software-complaints](../../research/bible-software-complaints.md).

**Readiness: likely finished** (2026-11-16, fourth pass, by [ready-criteria](../ready-criteria.md); never "accepted", which is the person's word). The overseer re-checked all ten on its own evidence: `words.py` read whole, the board (`words.pdf`) rendered and looked at window by window (W4 to W11), and the `wb` commands run against the database with an empty scratch study. One flaw was found and redrawn on this pass (the phone sheet, below). All ten pass.

- **1** B chosen by the person, W2 and W3 superseded and not drawn (Decisions; `words.py:5`, `:266`). W6 to W11 draw the chosen direction in the real conditions and propose no other.
- **2** every open question is struck (Open questions); W-7 to W-9 are decided below.
- **3 and 8, sheets match the README.** Seen on the rendered board:
  - The verse card's three tabs read Interlinear, In the Concordance, Definitions, each whole, in W4 and W7 (520 wide, one line), W10 (390 phone, one line) and W8 (floated, 300 wide: Interlinear and In the Concordance on the first line, Definitions on a second; nothing cut). `verse_tabs` (`words.py:70-81`) makes each tab as wide as its word and lets the row wrap (W-9).
  - W8 and W10 are drawn by the same functions as W4: `verse_card` (`words.py:93`, called at `:177`, `:211`, `:220`) and `verse_phone_sheet` (`:112`, called at `:247`).
  - W6, W9 and W11 draw the one door with BDB and Webster's under it (`door`, `words.py:128`, called at `:143` and `:258`), the same three buttons as concordance C10. "In the Concordance", "BDB", "Webster's", the count line and every chip are whole at 420 and at phone width. No Strong's or Every use button is on the board except W1, which is today's window and says so.
  - W7's left pane has the four tabs Numbers 25, Psalms 106, Phinehas, Concordance; W9's card is the same height as W6's with "412 pages name this word".
  - Redrawn on this pass: W10 and W11's sheet stopped about 57 px above the window's bottom, though the README and W10's caption say "a sheet over the bottom". `sheet_card` (`words.py:231`) now reaches the bottom edge; seen on the board in W10, W11 and concordance C13.
  - Scripture: Numbers 25:10-13 and Psalms 106:30-31 come through `K.fetch` (`words.py:18`, `:21`); `data/num25-10-13.json` and `data/ps106-30-31.json` equal `wb text` character for character, and `data/strong-H7065.json` equals `wb strong H7065` (all run 2026-11-16). Nothing is typed.
- **4** the build list below; each line names its input and result; the real-conditions line says what is seen at 300 and 390; the return case is its sixth line.
- **5** run 2026-11-16 with the release `wb`, each printing what the README says: `wb preview H7065`, `strong H7065`, `bdb H7065`, `interlinear "Num 25:11"`, `word-define --verse "Num 25:11"`, `word-define zealous`, `reader NUM 25`, `word NUM 25 11 16`, `verse NUM 25 11`, `anchor H7065`, `history list` (`crates/wb-cli/src/read.rs:48`, `:57`, `:60`, `:87`, `:94`, `:98`, `:103`, `:109`). `wb do` exists and answers that the app is not running. Missing as the Commands line says: `wb anchor H7065 --pages` ("unrecognized arguments") and `wb concordance` ("Unknown command"), each named as required here or in [concordance](../concordance/README.md).
- **6** [overlaps](../overlaps.md): a card vs a tab (`:22`), a verse opened alone (`:37`), a click on a word (`:38`), the word card (`:39`) and the verse card opened from the Concordance (`:40`) are resolved with words as owner; [coverage](../coverage.md) gives the cards to this folder alone (`:23`, `:49`).
- **7** the click setting is [settings](../settings/README.md)'s accepted Reading line (`settings/README.md:112`); float is [minimize](../minimize/README.md)'s floating pane (B2). Nothing here writes the study folder or changes scripture.
- **9** the cards hold the lemma, sound, Strong's words, renderings and a count; the board's text holds no suggestion, related word or commentary (every caption in `words.py` read; W5's hover card looked at).
- **10** no study-folder format changes: pages that name a word are found, not stored (W-5).

For the person, to decide acceptance, in this order: W4 (the verse card), W6 (the word card), W5 (hover), then the real conditions W7, W8, W9, W10, W11. W1 is today's window, for comparison only.

For other folders: the verse card and the phone sheet are `verse_card(...)` and `verse_phone_sheet(...)` in `words.py` (signatures in their docstrings; the sheet's `top` is its height above the window's bottom); [concordance](../concordance/README.md) C11 and C13 draw them by calling these (C-10, W-9).

What a word, a verse reference and hovering show. The card is bloated with notes (2bc9), fixed in place (dfce, 149b), and a reference in a page should open the verse with its lookups (94a1).

## Leading design (2026-11-12)

Round 1 reviewed 2026-11-16: the person chose direction B, so W4 and W5 lead and W2 and W3 are superseded. W1 is today.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | W1 | |
| A: a smaller card that moves | | W2, W3 (by B, the person, 2026-11-16) |
| B: a verse alone; a quiet hover card | W4, W5 | |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 2bc9 | Notes on the word bloat the card and show syntax |
| dfce | A reference's pop-up cannot be dragged or sized |
| 149b | Redesign notes & lookup; cards clickable and draggable |
| 94a1 | A verse opened from a note opens that verse only, with lookups |
| 2cd1 | Arrows through entries |
| efc3 | The edit button inside the card |
| f990 (2026-11-09) | Clicking a card edits its markdown; wants a friendlier way to change the card |
| ebdf (2026-11-10) | Why is "things" tagged G2556 and not "evil" or the whole phrase? |
| 5f45 (2026-11-11) | Clicking the place of a Strong's word page goes to the reader and opens nothing |

## Directions (round 1)

- **W1** today: the word sheet.
- **A** (W2, W3): a smaller card with a drag handle, a size corner, a pin, and ‹ › through entries; pages on the word as one count line.
- **B** (W4, W5): a reference opens the verse alone in a movable card with Interlinear / "In the Concordance" / Definitions; a quiet hover card. The "In the Concordance" door replaces the card's Strong's action (decision 2026-11-16).

## Decisions

- **2026-11-16 (the person): direction B is chosen** (W4, W5). W2 and W3 are superseded.
- **2026-11-16 (the person):** the verse card (W4, W5) takes the same single "In the Concordance" door in place of its Strong's action, as the word card does (concordance folder, [Round 1](../concordance/README.md) and [Round 2](../concordance/README.md) reviews). The overseer's recommendation was to keep Strong's as drawn and ask; the person chose the door.

The rest follow from those two; each is decided by overseer from existing decisions, dated 2026-11-16.

| # | Decision | Rests on |
|---|---|---|
| W-1 | W4 and W5 lead. W2 and W3 (A) are superseded by B. | the person, 2026-11-16 |
| W-2 | A plain click on a word opens its card. The other choice, the Concordance, is the Reading setting already accepted. | [settings](../settings/README.md) (a click on a word opens: card or Concordance); W5's text |
| W-3 | W4 and reader R9 are one design; W4 is it. | [overlaps](../overlaps.md); the person chose B |
| W-4 | There is no pin. The card's float button makes it [minimize](../minimize/README.md)'s floating pane (B2), and Open as a tab makes it a tab. Only then is it a step on the trail. | minimize; W4's text |
| W-5 | The card never draws a page's text or Markdown (2bc9). Pages that name the word or verse show as one count line that opens their list. | [marks](../marks/README.md) 2026-11-12: a page has no place, references are found; M9's line of counts |
| W-6 | ‹ › through entries (2cd1) belongs to the Concordance's number-order pages and to [books](../books/README.md) A, not the card. | W3 superseded; the one door |
| W-7 | The word card a click opens uses W4's frame (handle, float, close) with the one door. Drawn as W6. No longer an open question (2026-11-16): the door is the person's (concordance Round 1 and 2 reviews), and a card that drags and sizes is what the person's findings dfce and 149b ask for. | W-1, W-4; findings dfce, 149b; concordance Round 2 review |
| W-8 | The word card's content is [concordance](../concordance/README.md) C10's, which the person kept as drawn: the word, its number and sound, Strong's words, In the Concordance, and under it the BDB and Webster's buttons that open those books. W6, W9 and W11 were redrawn with the two buttons (2026-11-16, `door` in `words.py`). The verse card (W4) is unchanged: its Definitions tab stays. | concordance Round 2 review ("C10 ... kept as drawn"); `concordance.py` C10 |
| W-9 | The verse card's three tabs read Interlinear, In the Concordance, Definitions at every width; no label is cut or shortened. The tabs are as wide as their words, and where the three do not fit one line (floated at 300, phone width) the row takes a second line. W8 and W10 are drawn so (2026-11-16). Other folders that show this card draw it from `words.py` or exactly as W4 and W10 draw it ([concordance](../concordance/README.md) C11, C13). | the person's door, 2026-11-16 ("In the Concordance" is their wording); concordance C-4 (no second pop-up design); a design choice is not a setting |

W4 is redrawn with the "In the Concordance" door (2026-11-16): `words.py` no longer draws Strong's or Every use on W4, and W6 draws the word card under B (W-7). W1 still shows Every use because it is today's window. W2 and W3 are superseded and no longer drawn.

## Open questions

- ~~Does a plain click on a word still open the card?~~ Yes (W-2); struck 2026-11-16.
- ~~W4 is reader R9: one design or two?~~ One, W4 (W-3); struck 2026-11-16.
- ~~Does the pin make the card a floating pane or keep it a card?~~ No pin; float makes a floating pane (W-4); struck 2026-11-16.
- ~~W-7: does the word card a click opens take W4's frame with the one door?~~ Yes (W-7, W-8); struck 2026-11-16. The person sees it as W6 when the folder is offered for acceptance.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | see Directions | the first drawing | B chosen (W4, W5), the person, 2026-11-16 |

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25-10-13.json, ps106-30-31.json` | `wb text` |
| `data/strong-H7065.json` | `wb strong` |

Scripture and lookups are fetched from the database, never typed. Names of pages, questions, findings and documents are a drawn sample.

## What the build must satisfy

Direction B chosen (2026-11-16); the folder is not accepted. The windows are drawn (W4 to W11); W8 and W10 were redrawn so each tab is whole (W-9).

- [ ] A click on "zealous" in Numbers 25:11 opens the word card for H7065 when the Reading setting is card, and the Concordance at that entry when it is Concordance. With hover on, resting on the word shows its lemma, sound and Strong's words (what `wb preview H7065` prints) and nothing that can be clicked; with hover off, nothing shows.
- [ ] The word card holds the lemma, sound, Strong's words and renderings (what `wb word NUM 25 11 <i>` prints), one count line, In the Concordance, and the BDB and Webster's buttons (W-8). It has no Strong's or Every use button.
- [ ] A reference clicked in a page, in the Concordance or in a search opens that verse alone in a card: its text equal to `wb text` for the reference, then Interlinear / In the Concordance / Definitions, and Read the chapter. With the card 300 wide and at a 390-wide window, each of the three labels is shown whole (W-9).
- [ ] The card can be dragged by its handle to another spot and sized from its corner, and stays there until closed (dfce, 149b). Float makes it a floating pane; Open as a tab makes it a tab. Opening and closing a card adds no step to `wb history list`; floating it or opening it as a tab adds one.
- [ ] The card shows no page text or Markdown. A word named by 412 pages shows the one line "412 pages name this word", and that line opens their list (2bc9, f990).
- [ ] **Return case, the reader's place is kept (5f45, 94a1):** closing the card leaves the page or reader at the same scroll position and selection as before it opened. Read the chapter goes to that verse in the reader, and Back returns to the page and line the reference was clicked in.
- [ ] Commands. `wb word`, `wb verse`, `wb preview` keep printing what the cards show. The buttons reach existing commands: Interlinear `wb interlinear`, Definitions `wb word-define --verse`, BDB `wb bdb <n>`, Webster's `wb word-define <word>`, Read the chapter `wb reader`; In the Concordance is [concordance](../concordance/README.md)'s `wb concordance` and `wb strong`. Float and Open as a tab are lines the command box takes, so `wb do` reaches them; if [minimize](../minimize/README.md)'s build has not given them a line, they are required here. Missing, so required: `wb anchor <place|number> --pages`, the pages whose text names the place or number, with their count (`wb anchor H7065`, run 2026-11-16, lists only notes kept at the place).
- [ ] Real conditions are checked in the app on a generated study of years (below). Over a reader with four tabs, opening and closing the card leaves the four tabs, the tab in front and the reader's scroll as they were. Floated at 300 wide, the verse wraps and the three tabs and Read the chapter are all shown whole. At a 390-wide window the card is a sheet over the bottom, with the same three tabs whole. On a word named by 412 pages, the card shows the one count line and is no taller than on a word named by 2.

### The real conditions (the person, 2026-11-13)

| Condition | Window |
|---|---|
| Among other tabs | drawn, W7 (the card over a reader with four tabs open) |
| As a floating tab | drawn, W8 (the card floated, small) |
| Narrow | drawn, W10 (verse card) and W11 (word card) at phone width |
| Years of study | drawn, W9 (a word with 412 pages naming it, one count line) |

Drawn 2026-11-16: W4 with the door, the word card under B (W6, W-7) with C10's BDB and Webster's buttons (W-8), and the four windows above (W7 to W11). W8 and W10 were redrawn so the door's label is whole (W-9). Nothing here waits on the person except acceptance.

## Overlaps

[overlaps.md](../overlaps.md) lists the other folders that draw the same parts, and where they agree or conflict.
